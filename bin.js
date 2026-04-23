#!/usr/bin/env node

const p = require('path')
const Fuse = require('./')
const cmd = process.argv[2]

if (cmd === 'configure') {
  Fuse.configure(function (err) {
    if (err) {
      if (String(err.message).includes('You need to be root')) {
        process.stderr.write(
          '\n( Old fuse-shared-library only: "You need to be root" is a mislabel. Upstream @zkochan \n' +
            '  fuse-native on Darwin uses lib/darwin-fuse-kext-config.js with clearer errors. )\n\n'
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
