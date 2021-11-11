<template>
    <v-container>
        <v-card
            v-if="!isStableRelease"
            class="pa-5 my-2 UnstableRelease"
        >
            <v-icon class="WarningIcon px-3">
                {{ icons.alertCircle }}
            </v-icon>
            <span>You are not using the stable release version of FolkFriend, which is at <a href="https://folkfriend.app">folkfriend.app</a>. This is the development version, which may contain features which are untested.</span>
        </v-card>
        <v-card class="pa-5 my-2">
            <h1>About</h1>
            <p>
                FolkFriend listens to instrumental folk music, transcribes the
                melody to sheet music, and searches a database of traditional
                tunes for matches. You may either use the microphone on your
                device, or upload an existing audio file. FolkFriend runs
                entirely in browser and works without an internet connection.
            </p>
        </v-card>
        <v-card
            ref="helpDownload"
            class="pa-5 my-2"
        >
            <h1>Download</h1>
            <p>
                FolkFriend is a "Web App", which means it installs onto your
                Home Screen just like any other app.
            </p>
            <p
                v-if="isPWA"
                align="center"
            >
                FolkFriend is installed <v-icon class="pb-1 Installed">
                    {{ icons.checkCircle }}
                </v-icon>
            </p>
            <p v-else-if="ua.isSafari && ua.isMobile">
                On iOS Safari,
                <ul>
                    <li>
                        Tap <v-icon class="pb-2">
                            {{ icons.iosShare }}
                        </v-icon> "share"
                    </li>
                    <li>Scroll down</li>
                    <li>
                        Tap <v-icon class="pb-1">
                            {{ icons.iosAddToHomeScreen }}
                        </v-icon> "add to home screen"
                    </li>
                </ul>
            </p>
            <p v-else-if="ua.isChrome && ua.isMobile">
                On Chrome mobile,
                <ul>
                    <li>
                        Tap <v-icon class="pb-1">
                            {{ icons.dotsVertical }}
                        </v-icon> "Customise"
                    </li>
                    <li>
                        Tap <v-icon class="pb-1">
                            {{ icons.cellphoneArrowDown }}
                        </v-icon> "Install FolkFriend"
                    </li>
                </ul>
            </p>
            <p v-else-if="ua.isChrome && !ua.isMobile">
                On Chrome desktop,
                <ul>
                    <li>
                        Tap <v-icon class="pb-1">
                            {{ icons.cellphoneArrowDown }}
                        </v-icon> "install app"
                    </li>
                </ul>
            </p>
            <p v-else>
                To install FolkFriend, navigate to the settings of your browser
                and select "Add to Home Screen" or "Install App".
            </p>
        </v-card>
        <v-card
            ref="helpShare"
            class="pa-5 my-2"
        >
            <h1>Share</h1>
            <p>Scan the QR code on another device to open FolkFriend.</p>
            <v-img
                src="@/assets/qr-code.svg"
                class="mx-auto QRCode"
                align-center
                center
                contain
            />
        </v-card>
        <v-card class="pa-5 my-2">
            <h1>Feedback</h1>
            FolkFriend has been a five-year project by a single developer. 
            Please send any bugs reports, feature requests, or general feedback, 
            to <a
                class="feedbackEmail"
                href="mailto:feedback@folkfriend.app"
            >feedback@folkfriend.app</a>.
            <!-- TODO donations -->
            <!-- <h1>Donate</h1>
            <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                Pellentesque id tellus cursus, pellentesque tortor gravida,
                sollicitudin nulla. Nulla sit amet tellus nulla.
            </p> -->
        </v-card>
        <p class="AppInfo">
            App version: {{ frontendVersion }}<br>Backend version:
            {{ backendVersion }}<br>© 2021 Tom Wyllie. All Rights Reserved.
        </p>
    </v-container>
</template>

<script>
import store from '@/services/store.js';
import ffConfig from '@/ffConfig.js';
import eventBus from '@/eventBus';
import utils from '@/js/utils.js';

import {
    mdiAlertCircle,
    mdiCellphoneArrowDown,
    mdiCheckCircleOutline,
    mdiDotsVertical,
    mdiExportVariant,
    mdiPlusBoxOutline,
} from '@mdi/js';

export default {
    name: 'HelpView',
    props: {
        'download': {
            type: Boolean,
            required: false,
            default: false
        }, 
        'share':  {
            type: Boolean,
            required: false,
            default: false
        }, 
    },
    data: () => ({
        icons: {
            alertCircle: mdiAlertCircle,
            iosShare: mdiExportVariant,
            iosAddToHomeScreen: mdiPlusBoxOutline,
            checkCircle: mdiCheckCircleOutline,
            // TODO these haven't been added yet
            // mdiInstallDesktop: mdiInstallDesktop,
            // mdiInstallMobile: mdiInstallMobile,
            cellphoneArrowDown: mdiCellphoneArrowDown,
            dotsVertical: mdiDotsVertical,
        },
        isStableRelease: utils.isStableRelease(),
        isPWA: utils.checkStandalone(),
    }),
    computed: {
        backendVersion() {
            return store.state.backendVersion;
        },
        frontendVersion() {
            return ffConfig.FRONTEND_VERSION;
        },
    },
    created: function () {
        eventBus.$emit('parentViewActivated');
        this.ua = utils.checkUserAgent();
    },
    mounted: function () {
        if(this.download) {
            this.$refs['helpDownload'].$el.scrollIntoView();
        } else if(this.share) {
            this.$refs['helpShare'].$el.scrollIntoView();
        }
    },
};
</script>

<style scoped>
.feedbackEmail {
    font-weight: bold;
    color: --var(--v-primary-base);
}

.v-card {
    scroll-margin-top: 60px;
}

.AppInfo {
    color: dimgray;
    text-align: center;
    font-size: smaller;
}

.Installed {
    color: var(--v-secondary-base);
}

.QRCode {
    max-width: 240px;
    min-width: 100px;
    width: 40vw;
    fill: var(--v-primary-darken1);
}

.UnstableRelease {
    background: var(--v-secondary-lighten5);
}

.WarningIcon {
    animation: blinker 1.5s linear infinite;
    color: var(--v-secondary-base);
}

@keyframes blinker {
    50% {
        opacity: 0.2;
    }
}
</style>