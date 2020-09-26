<template>
    <v-app>
        <v-app-bar
            app
            color="primary"
            dark>
            <div class="d-flex align-center">
                <v-img
                    alt="Vuetify Logo"
                    class="shrink mr-2"
                    contain
                    src="https://cdn.vuetifyjs.com/images/logos/vuetify-logo-dark.png"
                    transition="scale-transition"
                    width="40"
                />

                <v-img
                    alt="Vuetify Name"
                    class="shrink mt-1 hidden-sm-and-down"
                    contain
                    min-width="100"
                    src="https://cdn.vuetifyjs.com/images/logos/vuetify-name-dark.png"
                    width="100"
                />
            </div>

            <v-spacer></v-spacer>
        </v-app-bar>

        <v-main>
            <router-link to="/">Home</router-link>
            |
            <router-link to="/about">About</router-link>
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

    }),
    mounted() {
        readyServices().then();
    }
};
</script>
