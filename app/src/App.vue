<template>
    <v-app>
        <v-navigation-drawer
            v-model="drawer"
            app
        >
            <!-- By the way the @click="0" thing adds the ripple animation.
                  Guess otherwise vuetify thinks it's not clickable?
                  The 0 is insignificant I just needed any valid javascript-->
            <v-list dense>
                <router-link to="/">
                    <v-list-item @click="0">
                        <v-list-item-action>
                            <v-icon medium>
                                {{ icons.microphone }}
                            </v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                            <v-list-item-title class="navBarEntry">
                                Search
                            </v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                </router-link>

                <router-link to="/notes">
                    <v-list-item @click="0">
                        <v-list-item-action>
                            <v-icon medium>
                                {{ icons.musicNote }}
                            </v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                            <v-list-item-title class="navBarEntry">
                                Notes
                            </v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                </router-link>

                <router-link to="/results">
                    <v-list-item @click="0">
                        <v-list-item-action>
                            <v-icon medium>
                                {{ icons.formatListBulleted }}
                            </v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                            <v-list-item-title class="navBarEntry">
                                Results
                            </v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                </router-link>

                <router-link to="/history">
                    <v-list-item @click="0">
                        <v-list-item-action>
                            <v-icon medium>
                                {{ icons.history }}
                            </v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                            <v-list-item-title class="navBarEntry">
                                History
                            </v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                </router-link>

                <router-link to="/settings">
                    <v-list-item @click="0">
                        <v-list-item-action>
                            <v-icon medium>
                                {{ icons.cog }}
                            </v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                            <v-list-item-title class="navBarEntry">
                                Settings
                            </v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                </router-link>

                <router-link to="/help">
                    <v-list-item @click="0">
                        <v-list-item-action>
                            <v-icon medium>
                                {{ icons.help }}
                            </v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                            <v-list-item-title class="navBarEntry">
                                About
                            </v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                </router-link>

                <a href="https://donorbox.org/help-support-development-of-folkfriend" target="_blank">
                    <v-list-item @click="0">
                        <v-list-item-action>
                            <v-icon medium>
                                {{ icons.heart }}
                            </v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                            <v-list-item-title class="navBarEntry">
                                Donate
                            </v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                </a>
            </v-list>
        </v-navigation-drawer>

        <v-app-bar
            app
            color="white"
            elevate-on-scroll
        >
            <v-icon
                v-if="hamburgerState === hamburgerStates.hamburger"
                color="primary"
                @click.stop="drawer = !drawer"
            >
                {{ icons.menu }}
            </v-icon>
            <v-icon
                v-else-if="hamburgerState === hamburgerStates.back"
                color="primary"
                @click="hamburgerBack"
            >
                {{ icons.chevronLeft }}
            </v-icon>
            <v-icon
                v-else-if="hamburgerState === hamburgerStates.cancel"
                color="primary"
                @click="hamburgerCancel"
            >
                {{ icons.close }}
            </v-icon>

            <v-img
                src="@/assets/logo.svg"
                max-height="90%"
                max-width="75%"
                class="mx-auto MainLogo"
                align-center
                center
                contain
            />
            <v-icon
                color="primary"
                @click="clickSettings"
            >
                {{ icons.cog }}
            </v-icon>
        </v-app-bar>

        <v-main>
            <router-view />
        </v-main>
    </v-app>
</template>


<script>
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';

import ffBackend from '@/services/backend.js';
import store from '@/services/store.js';
import eventBus from '@/eventBus.js';
import router from '@/router/index.js';
import {
    mdiChevronLeft,
    mdiCog,
    mdiClose,
    mdiDownload,
    mdiFormatListBulleted,
    mdiHelpCircleOutline,
    mdiHistory,
    mdiHeart,
    mdiMenu,
    mdiMicrophone,
    mdiMusicNote,
    // mdiShareVariant,
} from '@mdi/js';
import utils from '@/js/utils.js';

export default {
    name: 'App',
    data: () => ({
        drawer: null,
        menu: null,
        hamburgerStates: {
            hamburger: 'hamburger',
            back: 'back',
            cancel: 'cancel',
        },
        hamburgerState: 'hamburger',
        icons: {
            chevronLeft: mdiChevronLeft,
            cog: mdiCog,
            close: mdiClose,
            download: mdiDownload,
            formatListBulleted: mdiFormatListBulleted,
            heart: mdiHeart,
            help: mdiHelpCircleOutline,
            history: mdiHistory,
            menu: mdiMenu,
            microphone: mdiMicrophone,
            musicNote: mdiMusicNote,
            // shareVariant: mdiShareVariant,
        },
        isPWA: utils.checkStandalone(),
    }),
    mounted: function () {
        initSetup().then();

        // We cannot interrupt long running queries in WASM so we prevent the
        //  user from navigating to different pages in the app whilst recording
        //  or working. Otherwise they could navigate back to the search page
        //  and trigger multiple concurrent requests to the worker backend.
        //  This could happen accidentally on slow devices. Instead we nudge
        //  the user towards sitting tight and waiting if it's taking a while
        //  by having the nice gears animation and disabling the navigation
        //  hamburger. As a fallback, the navigation hamburger becomes a cross
        //  which refreshes the page in case recording / working hangs completely.
        eventBus.$on('setSearchState', () => {
            if (store.isReady()) {
                if (this.hamburgerState === this.hamburgerStates.cancel) {
                    this.hamburgerState = this.hamburgerStates.hamburger;
                }
            } else {
                this.hamburgerState = this.hamburgerStates.cancel;
            }
        });

        // When clicking on a link in a table, which is
        //  1.  Results table from audio query
        //  2.  Results table from name query
        //  3.  History of transcriptions / viewed tunes
        //  we navigate the user to a new page, without them having used
        //  the navbar directly. In these cases we smooth UX by having the
        //  hamburger convert to a back arrow which returns to the previous
        //  screen. For example when looking through tune results the user
        //  wants to check if an entry is the right tune, and if not then
        //  return to the results and try the next one down. This introduces
        //  a hierarchy for which hamburger navigation on its own becomes
        //  unintuitive and cumbersome.
        eventBus.$on('childViewActivated', () => {
            this.hamburgerState = this.hamburgerStates.back;
        });

        // Make sure hamburger is in the right state if we navigate back
        //  from a child view WITHOUT pressing the back button in app
        //  (e.g. physical back button on phone, alt + left shortcut on PC)
        eventBus.$on('parentViewActivated', () => {
            this.hamburgerState = this.hamburgerStates.hamburger;
        });

        eventBus.$on('indexLoaded', () => {
            store.state.indexLoaded = true;
        });
    },
    methods: {
        hamburgerBack() {
            router.back();
        },
        hamburgerCancel() {
            let result = window.confirm('Cancel this search?');
            if (result) {
                window.location.reload(false);
            }
        },
        clickSettings() {
            if(this.$route.name != 'settings') {
                // User can shortcut back to search if they tap the settings from there.
                //  If tapped from anywhere else just goes back to a normal hamburger state.
                if(this.$route.name == 'search') {
                    eventBus.$emit('childViewActivated');
                }

                router.push({ name: 'settings' });
            }
        },
    },
};

async function initAnalytics() {
    // Your web app's Firebase configuration
    const firebaseConfig = {
        // This **IS** okay to be public !!!
        apiKey: 'AIzaSyBy36nafCGgjwzQ1FvxUhHd6RyBZ_YnPis',
        authDomain: 'folk-friend.firebaseapp.com',
        databaseURL: 'https://folk-friend.firebaseio.com',
        projectId: 'folk-friend',
        storageBucket: 'folk-friend.appspot.com',
        messagingSenderId: '632280350288',
        appId: '1:632280350288:web:c4869728d2b5241b1edb55'
    };

    // Initialize Firebase analytics
    const app = initializeApp(firebaseConfig);
    const analytics = getAnalytics(app);
    store.loadAnalytics(analytics);
    store.logAnalyticsEvent('running_standalone', {'value': utils.checkStandalone()}).then();
}

async function initSetup() {
    ffBackend.version().then((version) => {
        store.state.backendVersion = version;
        console.info('Loaded folkfriend backend version', version);
    });
    await ffBackend.setupTuneIndex();
    await initAnalytics();
}
</script>

<style>
.v-list > a {
    text-decoration: none;
}

h1 {
    color: var(--v-secondary-base);
}

html, body {
    overscroll-behavior-y: contain;  
}

.viewContainerWrapper {
    display: block;
    max-width: min(90vh, 90vw);
    padding-left: 0;
    padding-right: 0;
    margin-left: auto;
    margin-right: auto;
}
</style>