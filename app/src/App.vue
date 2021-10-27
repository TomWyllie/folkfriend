<template>
    <v-app>
        <v-navigation-drawer v-model="drawer" app>
            <!-- By the way the @click="0" thing adds the ripple animation.
                  Guess otherwise vuetify thinks it's not clickable?
                  The 0 is insignificant I just needed any valid javascript-->
            <v-list dense>
                <router-link to="/">
                    <v-list-item @click="0">
                        <v-list-item-action>
                            <v-icon>{{ icons.microphone }}</v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                            <v-list-item-title>Search</v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                </router-link>

                <router-link to="/score">
                    <v-list-item @click="0">
                        <v-list-item-action>
                            <v-icon>{{ icons.musicNote }}</v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                            <v-list-item-title>Score</v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                </router-link>

                <router-link to="/results">
                    <v-list-item @click="0">
                        <v-list-item-action>
                            <v-icon>{{ icons.formatListBulleted }}</v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                            <v-list-item-title>Results</v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                </router-link>

                <router-link to="/history">
                    <v-list-item @click="0">
                        <v-list-item-action>
                            <v-icon>{{ icons.history }}</v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                            <v-list-item-title>History</v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                </router-link>

                <router-link to="/settings">
                    <v-list-item @click="0">
                        <v-list-item-action>
                            <v-icon>{{ icons.cog }}</v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                            <v-list-item-title>Settings</v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                </router-link>

                <router-link to="/help">
                    <v-list-item @click="0">
                        <v-list-item-action>
                            <v-icon>{{ icons.help }}</v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                            <v-list-item-title>Help</v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                </router-link>
            </v-list>
        </v-navigation-drawer>

        <v-app-bar app color="white" elevate-on-scroll>
            <v-icon
                v-if="hamburgerState === hamburgerStates.hamburger"
                color="primary"
                @click.stop="drawer = !drawer"
                >{{ icons.menu }}</v-icon
            >
            <v-icon
                v-else-if="hamburgerState === hamburgerStates.back"
                color="primary"
                @click="hamburgerBack"
                >{{ icons.arrowLeft }}</v-icon
            >
            <v-icon
                v-else-if="hamburgerState === hamburgerStates.cancel"
                color="primary"
                @click="hamburgerCancel"
                >{{ icons.close }}</v-icon
            >

            <v-img
                src="@/assets/logo.svg"
                max-height="90%"
                max-width="75%"
                class="mx-auto MainLogo"
                align-center
                center
                contain
            ></v-img>
            <v-btn icon color="primary">
                <v-icon>{{ icons.dotsVertical }}</v-icon>
            </v-btn>
        </v-app-bar>

        <v-main>
            <router-view />
        </v-main>
    </v-app>
</template>


<script>
import ffBackend from "@/services/backend.js";
import store from "@/services/store.js";
import eventBus from "@/eventBus.js";
import router from "@/router/index.js";
import {
    mdiArrowLeft,
    mdiCog,
    mdiClose,
    mdiDotsVertical,
    mdiFormatListBulleted,
    mdiHelpCircleOutline,
    mdiHistory,
    mdiMenu,
    mdiMicrophone,
    mdiMusicNote,
} from "@mdi/js";

export default {
    name: "App",
    data: () => ({
        drawer: null,
        menu: null,
        hamburgerStates: {
            hamburger: "hamburger",
            back: "back",
            cancel: "cancel",
        },
        hamburgerState: "hamburger",
        icons: {
            arrowLeft: mdiArrowLeft,
            cog: mdiCog,
            close: mdiClose,
            dotsVertical: mdiDotsVertical,
            formatListBulleted: mdiFormatListBulleted,
            help: mdiHelpCircleOutline,
            history: mdiHistory,
            menu: mdiMenu,
            microphone: mdiMicrophone,
            musicNote: mdiMusicNote,
        },
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
        eventBus.$on("setSearchState", () => {
            if (store.isReady()) {
                if (this.hamburgerState === this.hamburgerStates.cancel) {
                    this.hamburgerState = this.hamburgerStates.hamburger;
                }
            } else {
                this.hamburgerState = this.hamburgerStates.cancel;
            }
            // if(this.hamburgerState === this.hamburgerStates.cancel && store.isReady()) {
            //     this.hamburgerState = this.hamburgerStates.hamburger;
            // }
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
        eventBus.$on("childViewActivated", () => {
            this.hamburgerState = this.hamburgerStates.back;
        });

        // Make sure hamburger is in the right state if we navigate back
        //  from a child view WITHOUT pressing the back button in app
        //  (e.g. physical back button on phone, alt + left shortcut on PC)
        eventBus.$on("parentViewActivated", () => {
            this.hamburgerState = this.hamburgerStates.hamburger;
        });

        eventBus.$on("indexLoaded", () => {
            store.state.indexLoaded = true;
        });
    },
    methods: {
        hamburgerBack() {
            router.back();
        },
        hamburgerCancel() {
            let result = window.confirm("Cancel this search?");
            if (result) {
                window.location.reload(false);
            }
        },
    },
};

async function initSetup() {
    ffBackend.version().then((version) => {
        store.state.backendVersion = version;
        console.info("Loaded folkfriend backend version", version);
    });
    await ffBackend.setupTuneIndex();
}
</script>

<style scoped>
.v-list > a {
    text-decoration: none;
}
</style>