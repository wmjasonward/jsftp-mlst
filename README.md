# jsftp-mlst
Adds MLST/MLSD support to JSFtp for ftp servers that support the 'MSLT' feature.

Reference:

[JSFtp Homepage](https://github.com/sergi/jsftp "JSFtp Homepage")

[RFC 3659 - Extensions to FTP](https://tools.ietf.org/html/rfc3659#page-23 "rfc3659")

---

Be sure to check that the Ftp server supports MLST/MLSD feature before using this.
 See [How To](#how-to-test-for-mlst-feature-support) below.

If present in the MLST/MLSD server response entries, `Create` and `Modify` facts are
parsed and the attributes `create_dt` and `modify_dt`, respectively,
are added to the entry object.
`create_dt` and `modify_dt` are ISO 8601 combined date and time strings in UTC.
If `Create` and/or `Modify` cannot be parsed, `create_error` and/or `modify_error`
 messages, as appropriate, will added to the Entry object.

Fact names are normalized to lower case in the entry objects.

#### Starting it up

```javascript
var JSFtp = require("jsftp");
require('jsftp-mlst')(JSFtp);

var Ftp = new JSFtp({
  host: "myserver.com",
  port: 3331, // defaults to 21
  user: "user", // defaults to "anonymous"
  pass: "1234" // defaults to "@anonymous"
});
```

#### Added Methods

##### Ftp.mlst(pathname, callback)

With the `mlst` method you can retrieve the MLST entry for `pathname`. The method
accepts a callback with the signature `err, entry`, in which `err` is the error
response coming from the server (usually a 4xx or 5xx error code), or an error
indicating the MLST response couldn't be parsed as expected, and `entry`
is an object containing the entry facts returned by the server.

Pathname is optional. If omitted, the server is expected to return
an MLST entry for the current working directory.

```javascript

"use strict";

/**
 * Example using mlst
 */

const jsftp = require("jsftp");
require("jsftp-mlst")(jsftp);

const Ftp = new jsftp({
  host: "your.ftpserver.com",
  user: "ftpusername",
  pass: "ftppassword",
});


Ftp.on("connect", function() {
  Ftp.mlst("myfile.txt", (err, result) => {
    if (err) {
      console.log(err);
    } else {
      console.log(result);
    // Prints something like
    // { pathname: '/myfile.txt',
    //   create_dt: '2017-06-14T20:06:11+00:00',
    //   create: '20170614200611',
    //   modify_dt: '2017-06-14T20:06:11+00:00',
    //   modify: '20170614200611',
    //   perm: 'adfrw',
    //   size: '2291365',
    //   type: 'file',
    //   unique: 'ca032380be1',
    //   'unix.group': '501',
    //   'unix.mode': '0644',
    //  'unix.owner': '501' }
    }

    Ftp.destroy();
  });
});

```

##### Ftp.mlsd(pathname, callback)

With the `mlsd` method you can retrieve the contents of the 
directory specified with `pathname`. The `mlsd` method accepts a callback with the signature `err, entries`
where `err` is the error response coming from the server or 
error processing the server response, and `entries` is an 
array of entry objects containing the facts returned by the server
for each item in the directory (usually includes the dir itself).

`pathname` is optional. If omitted, the server is expected to return the contents of the current working directory.

```javascript

"use strict";

/**
 * Example using mlsd
 */

const jsftp = require("jsftp");
require("jsftp-mlst")(jsftp);

const Ftp = new jsftp({
  host: "your.ftpserver.com",
  user: "ftpusername",
  pass: "ftppassword",
});


Ftp.on("connect", function() {
  Ftp.mlsd("/", (err, entries) => {
    if (err) {
      console.log(err);
    } else {
      console.log(entries);
          // Prints something like
          // [{ pathname: 'myfile.txt',
          //   modify_dt: '2017-06-14T20:06:11+00:00',
          //   modify: '20170614200611',
          //   perm: 'adfrw',
          //   size: '2291365',
          //   type: 'file',
          //   unique: 'ca032380be1',
          //   'unix.group': '501',
          //   'unix.mode': '0644',
          //  'unix.owner': '501' },
          // { pathname: '..',
          //   modify_dt: '2017-06-14T20:06:19+00:00',
          //   modify: '20170614200619',
          //   perm: 'flcdmpe',
          //   type: 'pdir',
          //   unique: 'ca01u82148',
          //   'unix.group': '501',
          //   'unix.mode': '0700',
          //   'unix.owner': '501' },
          // { pathname: '.',
          //   modify_dt: '2017-06-14T20:06:19+00:00',
          //   modify: '20170614200619',
          //   perm: 'flcdmpe',
          //   type: 'cdir',
          //   unique: 'ca01u82148',
          //   'unix.group': '501',
          //   'unix.mode': '0700',
          //   'unix.owner': '501' }]
    }
    Ftp.destroy();
  });
});

```

##### Other Notes

OS Dependent Facts have a '.' in their names (see 'unix.xxx' facts in examples above).
If you need to read them you'll have to do something like:
`entry['unix.mode']`

MLSD/MLST implementation specifics vary across Ftp servers. The facts you receive
may be quite different than the examples above.

I tried to stick to the language support and eslint config of the
jsftp project for consistency.

##### To-Do

Add tests :) My current tests (not included in the repo) rely
on a couple of remote ftp servers I control that support MLST. I need to
create mock support for mlst/mlsd to test against.

##### How To Test For MLST Feature Support

The MLST feature has an extended format in the `FEAT` ftp command response so the
`hasFeat` method from JsFTP doesn't properly detect it. Here's an example of my
current recommendation for how to detect it:
```javascript

"use strict";

/**
 * Example checking for MLST support
 */

const jsftp = require("jsftp");
require("jsftp-mlst")(jsftp);

const Ftp = new jsftp({
  host: "your.ftpserver.com",
  user: "ftpusername",
  pass: "ftppassword",
});


Ftp.on("connect", function() {
  Ftp.getFeatures((err, features) => {
    // ... IRL handle err from getFeatures here!
    if (features.some(feat => feat.startsWith("mlst"))) {
      // server has MLST/MLSD support!
      Ftp.mlst("/", (err, entries) => {
        if (err) {
          console.log(err);
        } else {
          console.log(entries);
        }
      });
    } else {
      // server does not support MLST/MLSD
      console.log('server does not support MLST/MLSD');
    }
  });
});

```
Of course, you could also just call `mlst` or `mlsd` and and handle the error
that is passed to your callback if the server doesn't support it.

Keep in mind that MLST support by the server implies MLSD support as well.
