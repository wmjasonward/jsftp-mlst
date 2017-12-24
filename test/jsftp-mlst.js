/* vim:set ts=2 sw=2 sts=2 expandtab */
/*global require: true module: true */
/*
  * This sets up a local server just so we can construct jsftp
  * The ftpd package does not support mlst/mlsd so we just mock those
  * responses (we're not testing the ftp server here, just our ability to
  * handle an expected response from the server)
  *
  * @package jsftp-mlst
  * @copyright Copyright(c) 2017 Jason Ward
  * @author Jason Ward <wmjasonward@gmail.com>
  * @license https://github.com/wmjasonward/jsftp-checksum/blob/master/LICENSE
*/

"use strict";

// use assert like upstream jsftp
const assert = require("assert");
const sinon = require("sinon");
const jsftp = require("jsftp");
const ftpserver = require('./helpers/server');

require("../index.js")(jsftp);

const options = {
  // user: "user",
  // pass: "12345",
  // host: process.env.IP || "127.0.0.1",
  // port: process.env.PORT || 7002,
  user: "user",
  pass: "12345",
  host: process.env.IP || "127.0.0.1",
  port: process.env.PORT || 7002,
};

const testEntries = [
  {
    description: "parses standard mlst entry with modify and create facts",
    entry: "modify=20170614200619;create=20170612105331;perm=flcdmpe;type=file;unique=CA01U82148;UNIX.group=501;UNIX.mode=0700;UNIX.owner=501; /myfile.txt",
    expects: {
      pathname: "/myfile.txt",
      modify: "20170614200619",
      modify_dt: "2017-06-14T20:06:19+00:00",
      create: "20170612105331",
      create_dt: "2017-06-12T10:53:31+00:00",
      perm: "flcdmpe",
      type: "file",
      unique: "CA01U82148",
      "unix.group": "501",
      "unix.owner": "501",
      "unix.mode": "0700"
    },
  },
  {
    description: "parses mlst entry with no pathname",
    entry: "modify=20170614200619;create=20170612105331;perm=flcdmpe;type=file;unique=CA01U82148;UNIX.group=501;UNIX.mode=0700;UNIX.owner=501;",
    expects: {
      modify: "20170614200619",
      modify_dt: "2017-06-14T20:06:19+00:00",
      create: "20170612105331",
      create_dt: "2017-06-12T10:53:31+00:00",
      perm: "flcdmpe",
      type: "file",
      unique: "CA01U82148",
      "unix.group": "501",
      "unix.owner": "501",
      "unix.mode": "0700"
    },
  },
  {
    description: "parses mlst entry with no pathname, with trailing space",
    entry: "modify=20170614200619;create=20170612105331;perm=flcdmpe;type=file;unique=CA01U82148;UNIX.group=501;UNIX.mode=0700;UNIX.owner=501; ",
    expects: {
      modify: "20170614200619",
      modify_dt: "2017-06-14T20:06:19+00:00",
      create: "20170612105331",
      create_dt: "2017-06-12T10:53:31+00:00",
      perm: "flcdmpe",
      type: "file",
      unique: "CA01U82148",
      "unix.group": "501",
      "unix.owner": "501",
      "unix.mode": "0700"
    },
  },
  {
    description: "correctly formats _dt facts from timeval with millis",
    entry: "modify=20170614200619.412; /myfile.txt",
    expects: {
      pathname: "/myfile.txt",
      modify: "20170614200619.412",
      modify_dt: "2017-06-14T20:06:19.412+00:00",
    },
  },
  {
    description: "correctly rounds up from timeval with > millisecond precision",
    entry: "modify=20170614200619.412523131; /myfile.txt",
    expects: {
      pathname: "/myfile.txt",
      modify: "20170614200619.412523131",
      modify_dt: "2017-06-14T20:06:19.413+00:00",
    },
  },
  {
    description: "correctly rounds down from timeval with > millisecond precision",
    entry: "modify=20170614200619.4124923131; /myfile.txt",
    expects: {
      pathname: "/myfile.txt",
      modify: "20170614200619.4124923131",
      modify_dt: "2017-06-14T20:06:19.412+00:00",
    },
  },
  {
    description: "correctly formats partial seconds of 0 millis",
    entry: "modify=20170614200619.000; /myfile.txt",
    expects: {
      pathname: "/myfile.txt",
      modify: "20170614200619.000",
      modify_dt: "2017-06-14T20:06:19.000+00:00",
    },
  },
  {
    description: "correctly formats partial seconds < 100 millis (i.e. left pads)",
    entry: "modify=20170614200619.001; /myfile.txt",
    expects: {
      pathname: "/myfile.txt",
      modify: "20170614200619.001",
      modify_dt: "2017-06-14T20:06:19.001+00:00",
    },
  },
  {
    description: "correctly formats partial seconds < millisecond precision (i.e. right pads)",
    entry: "modify=20170614200619.1; /myfile.txt",
    expects: {
      pathname: "/myfile.txt",
      modify: "20170614200619.1",
      modify_dt: "2017-06-14T20:06:19.100+00:00",
    },
  }


];

describe("JsFTP Mlst/Mlsd Extension", function() {
  var ftp;
  var _server;

  before(function(done) {
    _server = ftpserver.makeServer(options);
    _server.listen(options.port);
    setTimeout(done, 100);
  });

  after(done => _server.close(done));

  beforeEach(done => {
    ftp = new jsftp(options);
    ftp.once("connect", done);
  });

  afterEach(done => {
    if (ftp) {
      ftp.destroy();
      ftp = null;
    }
    done();
  });

  describe("mlst entry parser", function() {
    // ensure we parse entries as expected (with special focus on ftp timeval to iso date conversion)
    // we'll go through the mlst command to get to parseMlstEntry
    testEntries.forEach(entry => {
      it(entry.description, done => {
        // mock a response from ftp.raw
        sinon.stub(ftp, "raw").callsArgWith(1, null, {
          code: 250,
          text: `250-Listing\n ${entry.entry}\n250 End.`, // ftp response parser returns \n rather than \r\n
          isError: false,
        });

        ftp.mlst((err, response) => {
          assert.deepEqual(response, entry.expects);
          ftp.raw.restore();
          done();
        });

      })
    });
  });

  // todo mlst and mlsd command tests
  // describe("mlst command", function() {
  //
  //
  // });
});
