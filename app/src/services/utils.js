// Self-contained functions which come in handy throughout the project

// https://grammar.yourdictionary.com/capitalization/rules-for-capitalization-in-titles.html
const LOWER_TITLE_WORDS = new Set(["a", "an", "the", "at", "by", "for", "in", "of", "on", "to", "up", "and", "as", "but", "or", "nor"]);

// Wrap in a class for ease of exports
export default class utils {
    static daysSince2020() {
        const unixMs = Date.now();
        const unixS = Math.round(unixMs / 1000);

        // 1577836800 = 2020-01-01T00:00:00+00:00 in ISO 8601
        const secsSince2020 = unixS - 1577836800;
        const daysSince2020 = Math.floor(secsSince2020 / (24 * 3600));

        // NO time travelling >:c
        return Math.max(0, daysSince2020);
    }

    static parseDisplayableName(rawName) {
        // https://bitbucket.org/Tom_Wyllie/folk-friend-web-app/src/master/app/js/folkfriend-app.js
        if (rawName.endsWith(', the')) {
            rawName = 'the ' + rawName.slice(0, -5);
        }

        let words = rawName.split(" ");

        // Ensure small words are not capitalised, unless they are at the start of the word
        for (let [i, word] of words.entries()) {
            if (!(LOWER_TITLE_WORDS.has(word.toLowerCase()) && i > 0)) {
                words[i] = words[i].charAt(0).toUpperCase() + words[i].slice(1);
            }
        }
        return words.join(" ");
    }

    static parseDisplayableDescription(setting) {
        return `${setting.dance} in ${setting.mode.slice(0, 4)}`;
    }

    static lerpColor(a, b, amount) {
        a = a.replace('#', '0x');
        b = b.replace('#', '0x');

        // https://gist.github.com/nikolas/b0cce2261f1382159b507dd492e1ceef
        const ar = a >> 16,
            ag = a >> 8 & 0xff,
            ab = a & 0xff,

            br = b >> 16,
            bg = b >> 8 & 0xff,
            bb = b & 0xff,

            rr = ar + amount * (br - ar),
            rg = ag + amount * (bg - ag),
            rb = ab + amount * (bb - ab);

        return `rgb(${Math.round(rr)}, ${Math.round(rg)}, ${Math.round(rb)})`;
    }

    static checkUserAgent() {
        //  https://github.com/ng-chicago/AddToHomeScreen
        const uaString = navigator.userAgent.toLowerCase();
        let ua = {};

        ua.isChrome = /chrome/.test(uaString);
        ua.isExplorer = /msie/.test(uaString);
        ua.isExplorer_11 = /rv:11/.test(uaString);
        ua.isFirefox = /firefox/.test(uaString);
        ua.isSafari = /safari/.test(uaString);
        ua.isOpera = /opr/.test(uaString);
        ua.isEdgeDesktop = /edge/.test(uaString);
        ua.isEdgeiOS = /edgios/.test(uaString);
        ua.isEdgeAndroid = /edga/.test(uaString);

        ua.isIOS = /ipad|iphone|ipod/.test(uaString);
        ua.isMobile = /mobile/.test(uaString);
        if ((ua.isChrome) && (ua.isSafari)) { ua.isSafari = false; }
        if ((ua.isChrome) && ((ua.isEdgeDesktop) ||
            (ua.isEdgeiOS) ||
            (ua.isEdgeAndroid))) { ua.isChrome = false; }
        if ((ua.isSafari) && ((ua.isEdgeDesktop) ||
            (ua.isEdgeiOS) ||
            (ua.isEdgeAndroid))) { ua.isSafari = false; }
        if ((ua.isChrome) && (ua.isOpera)) { ua.isChrome = false; }

        if (/ipad/.test(uaString)) {
            ua.whereIsShare = 'top';
        }

        return ua;
    }

    static checkStandalone() {
        //  https://github.com/ng-chicago/AddToHomeScreen
        return (window.matchMedia('(display-mode: standalone)').matches);
    }

    static isStableRelease() {
        return /folkfriend.app/.test(window.location.href.toLowerCase());
    }
}
