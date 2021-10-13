<template>
    <v-app>
        <v-navigation-drawer v-model="drawer" app>
            <!-- By the way the @click="0" thing adds the ripple animation.
                  Guess otherwise vuetify thinks it's not clickable?
                  The 0 is insignificant I just needed any valid javascript-->
            <v-list dense>
                <router-link tag="div" to="/">
                    <v-list-item @click="0">
                        <v-list-item-action>
                            <v-icon>{{ icons.microphone }}</v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                            <v-list-item-title>Search</v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                </router-link>

                <router-link tag="div" to="/score">
                    <v-list-item @click="0">
                        <v-list-item-action>
                            <v-icon>{{ icons.musicNote }}</v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                            <v-list-item-title>Score</v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                </router-link>

                <router-link tag="div" to="/results">
                    <v-list-item @click="0">
                        <v-list-item-action>
                            <v-icon>{{ icons.formatListBulleted }}</v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                            <v-list-item-title>Results</v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                </router-link>

                <router-link tag="div" to="/history">
                    <v-list-item @click="0">
                        <v-list-item-action>
                            <v-icon>{{ icons.history }}</v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                            <v-list-item-title>History</v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                </router-link>

                <router-link tag="div" to="/settings">
                    <v-list-item @click="0">
                        <v-list-item-action>
                            <v-icon>{{ icons.cog }}</v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                            <v-list-item-title>Settings</v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                </router-link>
            </v-list>
        </v-navigation-drawer>

        <v-app-bar app color="white" elevate-on-scroll>
            <v-icon color="primary" @click.stop="drawer = !drawer">{{
                icons.menu
            }}</v-icon>
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
import {
    mdiCog,
    mdiDotsVertical,
    mdiFormatListBulleted,
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

        icons: {
            cog: mdiCog,
            dotsVertical: mdiDotsVertical,
            formatListBulleted: mdiFormatListBulleted,
            history: mdiHistory,
            menu: mdiMenu,
            microphone: mdiMicrophone,
            musicNote: mdiMusicNote,
        },
    }),
    mounted: function () {
        initSetup().then();
    },
};

async function initSetup() {
    let version = await ffBackend.version();
    console.info("Loaded folkfriend backend version", version);

    console.debug("Fetching index JSON");
    await ffBackend.loadIndex();

    // await runQueryDemo();
}

async function runQueryDemo() {
    console.time("query-demo");
    const query =
        "xACEHCEAEACEFCAEACCAxAEACEFCHvvCECEAEACEFCCEACAxAEACEFCHvvCECEA";
    const results = await ffBackend.runTranscriptionQuery(query);
    console.debug(results);
    console.timeEnd("query-demo");
}
</script>
