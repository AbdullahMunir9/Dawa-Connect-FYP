// Scope location permission to the application's own top-level page.
export function isLocationRequester(window, contents, details, rendererUrl) {
  if (window.isDestroyed() || !contents || contents.isDestroyed()) return false
  if (contents !== window.webContents || details?.isMainFrame !== true) return false
  try {
    const expected = new URL(rendererUrl)
    const requested = new URL(details.requestingUrl)
    const current = new URL(contents.getURL())
    const matches = (url) => expected.protocol === 'file:'
      ? url.protocol === 'file:' && url.pathname === expected.pathname
      : url.origin === expected.origin
    return matches(requested) && matches(current)
  } catch {
    return false
  }
}

export function configureLocationPermissions(window, dialog, rendererUrl) {
  let granted = false
  let pending = null
  const session = window.webContents.session
  const trusted = (contents, details) => isLocationRequester(window, contents, details, rendererUrl)

  session.setPermissionCheckHandler((contents, permission, _origin, details) => {
    // Preserve Electron's existing behavior for unrelated application features.
    if (permission !== 'geolocation') return true
    return granted && trusted(contents, details)
  })
  session.setPermissionRequestHandler((contents, permission, callback, details) => {
    if (permission !== 'geolocation') return callback(true)
    if (!trusted(contents, details)) return callback(false)
    if (granted) return callback(true)
    if (!pending) {
      pending = dialog.showMessageBox(window, {
        type: 'question',
        title: 'Use current location',
        message: 'Allow DawaConnect to find this device\'s location?',
        detail: 'Location detection uses Google\'s geolocation service. Use it while at your pharmacy, then check the pin before registering.',
        buttons: ['Allow', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
        noLink: true
      }).then(({ response }) => {
        granted = response === 0
        return granted
      }).catch(() => false).finally(() => { pending = null })
    }
    pending.then((allowed) => callback(allowed && trusted(contents, details)))
  })
}
