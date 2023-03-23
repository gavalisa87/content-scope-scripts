import { WindowsMessagingConfig } from '../windows.js'
import { Messaging } from '../../index.js'

/**
 * These 3 required methods that get assigned by the Native side.
 */
// @ts-ignore
const windowsInteropPostMessage = window.chrome.webview.postMessage
// @ts-ignore
const windowsInteropAddEventListener = window.chrome.webview.addEventListener
// @ts-ignore
const windowsInteropRemoveEventListener = window.chrome.webview.removeEventListener

/**
 * With those methods available in the same lexical scope, we can then create
 * our WindowsMessagingConfig
 */
const config = new WindowsMessagingConfig({
  featureName: 'ExamplePage',
  methods: {
    postMessage: windowsInteropPostMessage,
    addEventListener: windowsInteropAddEventListener,
    removeEventListener: windowsInteropRemoveEventListener,
  },
})

/**
 * And then send notifications!
 */
const messaging = new Messaging(config)
messaging.notify('helloWorld')

/**
 * Or request some data
 */
messaging.request('getData', { foo: 'bar' }).then(console.log).catch(console.error)

/**
 * Or subscribe for push messages
 */
const unsubscribe = messaging.subscribe('getData', (data) => console.log(data))

// later
unsubscribe()