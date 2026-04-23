#!/usr/bin/env node

const p = require('path')
const Fuse = require('./')
const cmd = process.argv[2]

if (cmd === 'configure') {
  Fuse.configure(function (err) {
    if (err) {
      if (String(err.message).includes('You need to be root')) {
        process.stderr.write(
          '\nNote: That message is often generic. The underlying problem is usually FUSE ' +
            'installation, missing files, or permissions—not only whether you used sudo. ' +
            'See the README for your platform (macOS: `lib/darwin-fuse-kext-config.js` and ' +
            'the “macOS: Fuse.configure” section).\n\n'
        )
      }
      onerror(err)
    }
  })
} else if (cmd === 'unconfigure') {
  Fuse.unconfigure(onerror)
} else if (cmd === 'is-configured') {
  Fuse.isConfigured(function (err, bool) {
    if (err) return onerror(err)
    console.log('' + bool)
    process.exit(bool ? 0 : 1)
  })
}

function onerror (err) {
  if (err) throw err
}
