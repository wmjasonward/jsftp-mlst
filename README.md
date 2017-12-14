# jsftp-mlst
Decorate JSFtp with MLST/MLSD support

See:

[JSFtp Homepage](https://github.com/sergi/jsftp "JSFtp Homepage")

[RFC 3659 - Extensions to FTP](https://tools.ietf.org/html/rfc3659#page-23 "rfc3659")

Be sure to check that the Ftp server supports MLST/MLSD feature before using this.

If present in the MLST/MLSD response entries, `Create` and `Modify` facts are
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

Ftp.mlst('myfile.txt', (err, entry) => {
  if (err) {
    console.log(err);
  } else {
    console.log(entry);
    // Prints something like
    // { pathname: '/myfile.txt',
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
Ftp.mlsd('/', (err, entries) => {
  if (err) {
    console.log(err);
  } else {
    console.log(entry);
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
});
```

##### Other Notes

OS Dependent Facts have a '.' in their names (see 'unix.xxx' facts in examples above).
If you need to read them you'll have to do something like:
`entry['unix.mode']`

MLSD/MLST implementations vary across Ftp servers. YMMV

I tried to stick to the language support and eslint config of the
jsftp project for consistency.

##### To-Do

Add tests :) My current tests (not included in the repo) rely
on a couple of remote ftp servers I control that support MLST. I need to
create mock support for mlst/mlsd to test against.

Figure out why Ftp.hasFeat doesn't seem to work. Not sure if there's
an upstream problem or I'm just using it wrong. Ideally, you could
call Ftp.hasFeat('MLST') to ensure the server supports the feature.
As an alternative, create a `hasMlst` method that does a `Ftp.raw('feat'...)`
and looks for MLST in the response.
