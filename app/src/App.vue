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
                            <!-- <v-icon>mic</v-icon> -->
                            <v-icon>{{ svgPath }}</v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                            <v-list-item-title>Search</v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                </router-link>

                <router-link tag="div" to="/transcriptions">
                    <v-list-item @click="0">
                        <v-list-item-action>
                            <!-- <v-icon>music_note</v-icon> -->
                            <v-icon>{{ svgPath }}</v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                            <v-list-item-title>Output</v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                </router-link>

                <router-link tag="div" to="/searches">
                    <v-list-item @click="0">
                        <v-list-item-action>
                            <!-- <v-icon>format_list_bulleted</v-icon> -->
                            <v-icon>{{ svgPath }}</v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                            <v-list-item-title>Searches</v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                </router-link>

                <router-link tag="div" to="/history">
                    <v-list-item @click="0">
                        <v-list-item-action>
                            <!-- <v-icon>history</v-icon> -->
                            <v-icon>{{ svgPath }}</v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                            <v-list-item-title>History</v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                </router-link>

                <router-link tag="div" to="/settings">
                    <v-list-item @click="0">
                        <v-list-item-action>
                            <!-- <v-icon>settings</v-icon> -->
                            <v-icon>{{ svgPath }}</v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                            <v-list-item-title>Settings</v-list-item-title>
                        </v-list-item-content>
                    </v-list-item>
                </router-link>
            </v-list>
        </v-navigation-drawer>

        <v-app-bar app color="white" elevate-on-scroll>
            <!-- <v-icon color="primary" @click.stop="drawer = !drawer">menu</v-icon> -->
            <v-icon color="primary" @click.stop="drawer = !drawer">{{
                svgPath
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
                <v-icon>{{ svgPath }}</v-icon>
                <!-- <v-icon>more_vert</v-icon> -->
            </v-btn>
        </v-app-bar>

        <v-main>
            <router-view />
        </v-main>
    </v-app>
</template>


<script>
import { mdiAccount } from "@mdi/js";

export default {
    name: "App",
    data: () => ({
        drawer: null,
        menu: null,
        svgPath: mdiAccount,
    }),
    mounted: function () {
        // readyServices().then();
    },
};
</script>
