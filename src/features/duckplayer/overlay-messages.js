/* eslint-disable promise/prefer-await-to-then */
import * as constants from './constants.js'

/**
 * @typedef {import("@duckduckgo/messaging").Messaging} Messaging
 *
 * A wrapper for all communications.
 *
 * Please see https://duckduckgo.github.io/content-scope-utils/modules/Webkit_Messaging for the underlying
 * messaging primitives.
 */
export class DuckPlayerOverlayMessages {
    /**
     * @param {Messaging} messaging
     * @internal
     */
    constructor (messaging) {
        /**
         * @internal
         */
        this.messaging = messaging
    }

    /**
     * Inform the native layer that an interaction occurred
     * @param {import("../duck-player.js").UserValues} userValues
     * @returns {Promise<import("../duck-player.js").UserValues>}
     */
    setUserValues (userValues) {
        return this.messaging.request(constants.MSG_NAME_SET_VALUES, userValues)
    }

    /**
     * @returns {Promise<import("../duck-player.js").UserValues>}
     */
    getUserValues () {
        return this.messaging.request(constants.MSG_NAME_READ_VALUES, {})
    }

    /**
     * @param {Pixel} pixel
     */
    sendPixel (pixel) {
        this.messaging.notify(constants.MSG_NAME_PIXEL, {
            pixelName: pixel.name(),
            params: pixel.params()
        })
    }

    /**
     * @param {OpenInDuckPlayerMsg} params
     */
    openInDuckPlayerViaMessage (params) {
        return this.messaging.notify(constants.MSG_NAME_OPEN_PLAYER, params)
    }

    /**
     * Get notification when preferences/state changed
     * @param {(userValues: import("../duck-player.js").UserValues) => void} cb
     */
    onUserValuesChanged (cb) {
        return this.messaging.subscribe('onUserValuesChanged', cb)
    }

    /**
     * This allows our SERP to interact with Duck Player settings.
     */
    serpProxy () {
        function respond (kind, data) {
            window.dispatchEvent(new CustomEvent(constants.MSG_NAME_PROXY_RESPONSE, {
                detail: { kind, data },
                composed: true,
                bubbles: true
            }))
        }

        // listen for setting and forward to the SERP window
        this.onUserValuesChanged((values) => {
            respond(constants.MSG_NAME_PUSH_DATA, values)
        })

        // accept messages from the SERP and forward them to native
        window.addEventListener(constants.MSG_NAME_PROXY_INCOMING, (evt) => {
            try {
                assertCustomEvent(evt)
                if (evt.detail.kind === constants.MSG_NAME_SET_VALUES) {
                    this.setUserValues(evt.detail.data)
                        .then(updated => respond(constants.MSG_NAME_PUSH_DATA, updated))
                        .catch(console.error)
                }
                if (evt.detail.kind === constants.MSG_NAME_READ_VALUES) {
                    this.getUserValues()
                        .then(updated => respond(constants.MSG_NAME_PUSH_DATA, updated))
                        .catch(console.error)
                }
            } catch (e) {
                console.warn('cannot handle this message', e)
            }
        })
    }
}

/**
 * @param {any} event
 * @returns {asserts event is CustomEvent<{kind: string, data: any}>}
 */
function assertCustomEvent (event) {
    if (!('detail' in event)) throw new Error('none-custom event')
    if (typeof event.detail.kind !== 'string') throw new Error('custom event requires detail.kind to be a string')
}

export class Pixel {
    /**
     * A list of known pixels
     * @param {{name: "overlay"} | {name: "play.use", remember: "0" | "1"} | {name: "play.do_not_use", remember: "0" | "1"}} input
     */
    constructor (input) {
        this.input = input
    }

    name () {
        return this.input.name
    }

    params () {
        switch (this.input.name) {
        case 'overlay': return {}
        case 'play.use':
        case 'play.do_not_use': {
            return { remember: this.input.remember }
        }
        default: throw new Error('unreachable')
        }
    }
}

export class OpenInDuckPlayerMsg {
    /**
     * @param {object} params
     * @param {string} params.href
     */
    constructor (params) {
        this.href = params.href
    }
}
