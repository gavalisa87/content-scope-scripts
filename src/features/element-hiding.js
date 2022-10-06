import { isBeingFramed, getFeatureSetting, matchHostname, DDGProxy, DDGReflect } from '../utils'

let adLabelStrings = []
const parser = new DOMParser()

function collapseDomNode (element, type, previousElement) {
    if (!element) {
        return
    }

    const alreadyHidden = [...element.classList].includes('ddg-hidden') || element.closest('.ddg-hidden')

    if (alreadyHidden) {
        return
    }

    switch (type) {
    case 'hide':
        hideNode(element)
        break
    case 'hide-empty':
        if (isDomNodeEmpty(element)) {
            hideNode(element)
        }
        break
    case 'closest-empty':
        // only want to hide the outermost empty node so that we may easily
        // unhide if ad loads
        if (isDomNodeEmpty(element)) {
            collapseDomNode(element.parentNode, type, element)
        } else if (previousElement) {
            hideNode(previousElement)
        }
        break
    default:
        console.log(`Unsupported rule: ${type}`)
    }
}

function hideNode (element) {
    element.classList.add('ddg-hidden')
    element.hidden = true
}

function isDomNodeEmpty (node) {
    // no sense wasting cycles checking if the page's body element is empty
    if (node.tagName === 'BODY') {
        return false
    }
    // use a DOMParser to remove all metadata elements before checking if
    // the node is empty.
    const parsedNode = parser.parseFromString(node.outerHTML, 'text/html').documentElement
    parsedNode.querySelectorAll('base,link,meta,script,style,template,title,desc').forEach((el) => {
        el.remove()
    })

    const visibleText = parsedNode.innerText.trim().toLocaleLowerCase()
    const mediaContent = parsedNode.querySelector('video,canvas')
    const frameElements = [...parsedNode.querySelectorAll('iframe')]
    // about:blank iframes don't count as content, return true if:
    // - node doesn't contain any iframes
    // - node contains iframes, all of which are hidden or have src='about:blank'
    const noFramesWithContent = frameElements.every((frame) => {
        return (frame.hidden || frame.src === 'about:blank')
    })
    if ((visibleText === '' || adLabelStrings.includes(visibleText)) &&
        noFramesWithContent && mediaContent === null) {
        return true
    }
    return false
}

function applyRules (rules) {
    const document = globalThis.document

    // hide ad elements immediately, then try again in 250ms to catch any
    // elements added to the page after load
    hideAdNodes(rules)
    setTimeout(function () {
        hideAdNodes(rules)
    }, 250)

    // simulate scenario where ad loads into hidden container after 500ms
    if (document.location.host === 'fortune.com') {
        setTimeout(simulateAdLoad, 500)
    }

    // check hidden ad elements for contents, unhide if content has loaded
    setTimeout(unHideLoadedAds, 750)
}

function simulateAdLoad () {
    const document = globalThis.document
    const hiddenElements = [...document.querySelectorAll('.ddg-hidden')]
    hiddenElements.forEach((element) => {
        const newAd = document.createElement('iframe')
        element.firstChild.append(newAd)
    })
}

function hideAdNodes (rules) {
    rules.forEach((rule) => {
        const matchingElementArray = [...document.querySelectorAll(rule.selector)]
        matchingElementArray.forEach((element) => {
            collapseDomNode(element, rule.type)
        })
    })
}

function unHideLoadedAds () {
    const document = globalThis.document
    const hiddenElements = [...document.querySelectorAll('.ddg-hidden')]
    hiddenElements.forEach((element) => {
        if (!isDomNodeEmpty(element)) {
            element.classList.remove('ddg-hidden')
            element.hidden = false
        }
    })
}

function injectStyleTag () {
    const document = globalThis.document
    document.head.insertAdjacentHTML('beforeend', '<style type="text/css">.ddg-hidden{display:none!important}</style>')
}

export function init (args) {
    if (isBeingFramed()) {
        return
    }

    const featureName = 'elementHiding'
    const domain = args.site.domain
    const domainRules = getFeatureSetting(featureName, args, 'domains')
    const globalRules = getFeatureSetting(featureName, args, 'rules')
    adLabelStrings = getFeatureSetting(featureName, args, 'adLabelStrings')

    // collect all matching rules for domain
    const activeDomainRules = domainRules.filter((rule) => {
        return matchHostname(domain, rule.domain)
    }).flatMap((item) => item.rules)

    const overrideRules = activeDomainRules.filter((rule) => {
        return rule.type === 'override'
    })

    let activeRules = activeDomainRules.concat(globalRules)

    // remove overrides and rules that match overrides from array of rules to be applied to page
    overrideRules.forEach((override) => {
        activeRules = activeRules.filter((rule) => {
            return rule.selector !== override.selector
        })
    })

    // now have the final list of rules to apply, so we apply them when document is loaded
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', (event) => {
            injectStyleTag()
            applyRules(activeRules)
        })
    } else {
        injectStyleTag()
        applyRules(activeRules)
    }
    // single page applications don't have a DOMContentLoaded event on navigations, so
    // we use proxy/reflect on history.pushState to call hideMatchingDomNodes on page
    // navigations, and listen for popstate events that indicate a back/forward navigation
    const historyMethodProxy = new DDGProxy(featureName, History.prototype, 'pushState', {
        apply (target, thisArg, args) {
            applyRules(activeRules)
            return DDGReflect.apply(target, thisArg, args)
        }
    })
    historyMethodProxy.overload()

    window.addEventListener('popstate', (event) => {
        applyRules(activeRules)
    })
}
