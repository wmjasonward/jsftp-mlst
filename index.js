/* vim:set ts=2 sw=2 sts=2 expandtab */
/*global require: true module: true */
/*
 * @package jsftp-mlst
 * @copyright Copyright(c) 2017 Jason Ward
 * @author Jason Ward <wmjasonward@gmail.com>
 * @license https://github.com/wmjasonward/jsftp-mlst/blob/master/LICENSE
 */

"use strict";
var once = require("once");
var inherits = require("util").inherits;

module.exports = function(jsftp) {

  /**
   * Helper function to convert an ftp time-val to a
   * utc iso date string "YYYY-MM-DDTHH:MM:SS.nnn+00:00
   *
   * RFC 3659 allows for arbitrary precision for parts of a second
   * this helper will only go to millisecond precision - anything else is rounded
   *
   * @param {string} timeval - The ftp time-val (probably from a mlst fact)
   * @returns {string} The "iso" formatted string
   */
  function ftpTimeValToIsoDate(timeval) {
    var parts = timeval.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\.\d+)?$/);
    if (!(parts && parts.length > 0)) {
      throw new Error("Unable to parse ftp time-val: " + timeval);
    }

    var millis = "";
    if (parts[7]) {
      millis = "." + Math.round((parseFloat(parts[7]) * 1000));
    }

    return `${parts[1]}-${parts[2]}-${parts[3]}T${parts[4]}:${parts[5]}:${parts[6]}${millis}+00:00`;
  }

  /**
   * Parse and Mlst entry (and, by extension Mlsd entry)
   *
   * @param {string} entry entry line from ftp server (type=file;create=xxxxxxxxx;...)
   * @returns {object} entry facts
   */
  function parseMlstEntry(entry) {
    var parts = entry.trim().split(" "); // separate the facts from the pathname
    if (parts.length > 2) {
      if (parts[0].length === 0) {
        parts.shift();  // in case we had a space at the beginning
      } else {
        throw new Error("Mlst/Mlsd entry has too many parts: {" + entry + "}");
      }
    }

    var response = {};
    if (parts.length > 1 && parts[1].length > 0) { // may not have a pathname if none was specified in command
      response["pathname"] = parts[1];
    }

    var facts = parts[0].split(";");
    for (var i = 0; i < facts.length; i++) {
      var fe = facts[i].indexOf("="); // doing this way - rather than split - in case there can be an "=" in the fact value
      if (fe > 0) { // if nothing before the = - not really usable anyway
        var factname = facts[i].substr(0, fe).toLowerCase();
        var factvalue = facts[i].substr(fe + 1).toLowerCase();

        switch (factname) {
          case "create":
          case "modify":
            response[factname + "_dt"] = ftpTimeValToIsoDate(factvalue);
            break;
        }
        response[factname] = factvalue;
      }
    }

    return response;
  }

  /**
   * Executes MLST on the ftp server
   *
   * Caller should ensure MLST is supported by calling hasFeat("MLST") first
   *
   * @param {string} path Optional - The pathname to retrieve the mlst listing for
   * @returns {object} mlst entry facts
   *
   */
  jsftp.prototype.mlst = function(path, callback) {
    if (arguments.length === 1) {
      callback = arguments[0];
      path = "";
    }

    var self = this;

    this.raw("MLST " + path, function(err, response) {
      if (err) {
        callback(err);
      } else {
        // per the rfc, expecting a 250 response and a total of 3 lines
        if (response.code === 250) {
          var lines = response.text.split("\n"); // response parser converts crlf to lf
          if (lines.length === 3) {
            callback(null, parseMlstEntry(lines[1]));
          } else {
            callback({
              Error: "Expected 3 lines in mlst command response",
              code: response.code,
              text: response.text,
              isError: true,
            }, null);
          }
        } else {
          callback({
            Error: "Expected 250 response from MLST command",
            code: response.code,
            text: response.text,
            isError: true,
          }, null);
        }
      }
    });
  };

  /**
   * Calls MLSD to list a path using a passive connection.
   * See <a href="https://tools.ietf.org/html/rfc3659">RFC 3659</a>
   *
   * Requires feature "MLST" - jsftp.hasFeat("MLST")
   *
   * If successful, the callback will be passed an array of entry objects
   *
   * This follows the pattern in jsftp.list
   *
   * @param {String} path Optional Remote path to list using MLSD
   * @param {Function} callback Function to call with errors or results
   */
  jsftp.prototype.mlsd = function(path, callback) {
    if (arguments.length === 1) {
      callback = arguments[0];
      path = "";
    }

    var self = this;
    var data = ""; // from data connection
    callback = once(callback);

    self.getPasvSocket(function(err, socket) {
      if (err) {
        return callback(err);
      }

      socket.setEncoding("utf8");
      socket.on("data", function(d) {
        data += d;
      });

      self.pasvTimeout(socket, callback);

      socket.once("close", function(err) {

        var lines = data.split("\r\n");
        var entries = [];
        for (var i = 0; i < lines.length; i++) {
          if (lines[i].length > 0) {
            entries.push(parseMlstEntry(lines[i]));
          }
        }
        callback(err, entries);
      });

      socket.once("error", callback);

      function cmdCallback(err, res) {
        if (err) {
          return callback(err);
        }

        var isExpectedMark = this.expectedMarks.some(function(mark) {
          return mark === res.code;
        });

        if (!isExpectedMark) {
          callback(new Error(
            "Expected marks " + this.expectedMarks.toString() + " instead of: " +
            res.text));
        }
      }

      cmdCallback.expectedMarks = {
        marks: [150],
        ignore: 226
      };

      self.execute("MLSD " + (path || ""), cmdCallback);
    });
  };

  return jsftp;
};
