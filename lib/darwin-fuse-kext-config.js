/**
 * macOS: configure / isConfigured for the macFUSE kernel extension helper, with
 * wider paths for macfuse.fs.tgz and clearer errors (no fake "You need to be root").
 */
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const BUNDLE = '/Library/Filesystems/macfuse.fs'
const CONFIGURED = path.join(BUNDLE, 'configured')
const LOAD = path.join(BUNDLE, 'Contents/Resources/load_macfuse')
const LEGACY_VERSION = '4.1.2'

function tgzList () {
  const out = new Set()
  if (process.env.MACFUSE_TGZ) {
    out.add(process.env.MACFUSE_TGZ)
  }
  for (const r of [ '/usr/local/lib', '/opt/homebrew/lib' ]) {
    out.add(path.join(r, 'macfuse.fs.tgz'))
  }
  const hp = process.env.HOMEBREW_PREFIX
  if (hp) {
    out.add(path.join(hp, 'lib/macfuse.fs.tgz'))
  }
  for (const caskRoot of [ '/opt/homebrew/Caskroom/macfuse', '/usr/local/Caskroom/macfuse' ]) {
    if (!fs.existsSync(caskRoot)) {
      continue
    }
    try {
      for (const ver of fs.readdirSync(caskRoot)) {
        out.add(path.join(caskRoot, ver, 'macfuse.fs.tgz'))
      }
    } catch {
      // ignore
    }
  }
  return [...out]
}

function findMacfuseTgz () {
  for (const p of tgzList()) {
    if (p && fs.existsSync(p)) {
      return p
    }
  }
  return null
}

function loadPathSync () {
  return fs.existsSync(LOAD) ? LOAD : null
}

function isConfigured (cb) {
  if (!cb) {
    return
  }
  if (loadPathSync()) {
    return cb(null, true)
  }
  fs.readFile(CONFIGURED, 'utf-8', (err, str) => {
    if (err && err.code === 'ENOENT') {
      return cb(null, false)
    }
    if (err) {
      return cb(err)
    }
    return cb(null, /^\d+\.\d+/.test((str || '').trim()))
  })
}

function run (args, cb) {
  const child = spawn(args[0], args.slice(1), { stdio: ['ignore', 'pipe', 'pipe'] })
  let combined = ''
  const add = (c) => {
    combined += c
  }
  child.stdout.on('data', add)
  child.stderr.on('data', add)
  child.on('error', (e) => {
    cb(e)
  })
  child.on('exit', (code) => {
    if (code === 0) {
      return cb(null)
    }
    const d = combined.trim()
    return cb(
      new Error('Command failed: ' + args.join(' ') + (d ? '\n' + d : '') + (code != null ? '\n(exit ' + code + ')' : ''))
    )
  })
}

function runAll (cmds, cb) {
  const step = (err) => {
    if (err) {
      return cb(err)
    }
    if (!cmds.length) {
      return cb(null)
    }
    if (typeof cmds[0] === 'function') {
      return cmds.shift()(step)
    }
    run(cmds.shift(), step)
  }
  step(null)
}

function unconfigure (cb) {
  if (!cb) {
    cb = () => {}
  }
  run(['rm', '-rf', BUNDLE], cb)
}

function ensureMarker (cb) {
  fs.writeFile(CONFIGURED, LEGACY_VERSION + '\n', cb)
}

function configure (cb) {
  if (!cb) {
    cb = () => {}
  }
  isConfigured((err, yes) => {
    if (err) {
      return cb(err)
    }
    if (yes) {
      return cb(null)
    }
    const load = loadPathSync()
    if (load) {
      // Only add marker and setuid; bundle came from the macFUSE .pkg
      return runAll(
        [
          (c) => {
            ensureMarker(c)
          },
          (c) => {
            run(['chmod', '+s', load], c)
          }
        ],
        cb
      )
    }
    const tgz = findMacfuseTgz()
    if (!tgz) {
      return cb(
        new Error(
          'macfuse.fs.tgz not found. Checked\n' +
            tgzList()
              .map((p) => '  ' + p)
              .join('\n') +
            '\nInstall macFUSE (https://github.com/osxfuse/osxfuse/releases) or set MACFUSE_TGZ to the tgz path, then: sudo node ./bin.js configure'
        )
      )
    }
    return runAll(
      [
        ['mkdir', '-p', BUNDLE],
        ['tar', 'xzf', tgz, '-C', BUNDLE],
        ['chown', '-R', 'root:wheel', BUNDLE],
        (c) => {
          const p = loadPathSync()
          if (!p) {
            return c(new Error('load_macfuse missing under ' + BUNDLE + ' after tar; macFUSE layout may have changed.'))
          }
          return run(['chmod', '+s', p], c)
        },
        (c) => {
          ensureMarker(c)
        },
        (c) => {
          const p = loadPathSync()
          if (!p) {
            return c()
          }
          return run([p], c)
        }
      ],
      cb
    )
  })
}

module.exports = {
  configure,
  unconfigure,
  isConfigured
}
