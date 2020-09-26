<template>
    <v-app>
        <v-navigation-drawer v-model="drawer" app>
            <v-list dense>
                <v-list-item link>
                    <v-list-item-action>
                        <v-icon>mdi-home</v-icon>
                    </v-list-item-action>
                    <v-list-item-content>
                        <v-list-item-title>
                            <router-link to="/">Home</router-link>
                        </v-list-item-title>
                    </v-list-item-content>
                </v-list-item>
                <v-list-item link>
                    <v-list-item-action>
                        <v-icon>mdi-email</v-icon>
                    </v-list-item-action>
                    <v-list-item-content>
                        <v-list-item-title>
                            <router-link to="/about">About</router-link>
                        </v-list-item-title>
                    </v-list-item-content>
                </v-list-item>
            </v-list>
        </v-navigation-drawer>

        <v-app-bar app color="indigo" dark>
            <v-app-bar-nav-icon @click.stop="drawer = !drawer"></v-app-bar-nav-icon>
            <v-toolbar-title>Application</v-toolbar-title>
        </v-app-bar>

        <v-main>
            <router-view/>
        </v-main>
    </v-app>
</template>

<script>
// import HelloWorld from './components/HelloWorld';

import ds from '@/services/database.worker';
import transcriber from "@/folkfriend/ff-transcriber.worker";
import queryEngine from "@/folkfriend/ff-query-engine";

async function readyServices() {
    // Order non-trivial here, we initialise things likely
    //  to be needed sooner, first.
    const start = Date.now();
    await transcriber.initialise();
    console.debug(`Transcriber ready in ${Date.now() - start} ms`);
    await ds.initialise();
    console.debug(`Database worker ready in ${Date.now() - start} ms`);
    await queryEngine.initialise();
    console.debug(`Query engine ready in ${Date.now() - start} ms`);
    console.debug(`All services ready in ${Date.now() - start} ms`);
}

export default {
    name: 'App',
    data: () => ({
        drawer: null,
    }),
    mounted() {
        readyServices().then();
    }
};
</script>
