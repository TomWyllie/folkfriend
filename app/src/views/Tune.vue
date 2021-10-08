<template>
    <v-container class="tune mx-auto" v-if="!empty">
        <h1
            class="my-2"
            :style="`color:${this.$vuetify.theme.currentTheme.secondary};`"
        >
            {{ this.name }}
        </h1>
        <v-container class="my-1" v-show="!noAliases">
            <span class="font-italic text--secondary">Alternative names: </span>
            <!-- <v-chip
                v-for="alias in this.aliases"
                :key="alias"
                class="nameChip ma-1"
                label
                small
            >{{ alias }}
            </v-chip> -->
        </v-container>
        <v-expansion-panels v-model="expandedIndex" multiple>
            <v-expansion-panel
                v-show="settings"
                v-for="settingData in this.settings"
                :key="settingData.setting"
                :setting="settingData"
            >
                <v-expansion-panel-header>
                    <!-- <h3 class="descriptor font-weight-medium">
                        {{ `${settingData.type} in ${settingData.mode.slice(0, 4)}` }}
                    </h3> -->
                </v-expansion-panel-header>
                <v-expansion-panel-content>
                    <!-- <AbcDisplay
                        :abc="settingData.abc"
                        :mode="settingData.mode"
                        :meter="settingData.meter"
                    ></AbcDisplay> -->
                    <div>placeholder ABC display</div>
                </v-expansion-panel-content>
            </v-expansion-panel>
        </v-expansion-panels>
    </v-container>
    <!-- This actually shouldn't ever happen unless the user manually navigates to /tunes -->
    <v-container v-else>
        <p>No tune loaded. Please search for a tune.</p>
    </v-container>
</template>

<script>
// import ds from "@/services/database.worker";
// import utils from "@/folkfriend/ff-utils";
// import AbcDisplay from "@/components/AbcDisplay";

// export default {
//     name: "Tune",
//     data: function () {
//         return {
//             // Important it starts empty otherwise we see it flash very
//             //  briefly on load.
//             empty: false,
//             settings: null,
//             aliases: null,
//             noAliases: true,
//             expandedIndex: []
//         };
//     },
//     computed: {
//         name: function () {
//             if (this.settings) {
//                 return utils.parseDisplayableName(this.settings[0].name);
//             }
//             return '';
//         },
//     },
//     components: {AbcDisplay},
//     mounted: async function () {
//         if (this.tuneID) {
//             this.settings = await ds.loadTune(this.tuneID);
//             const aliases = await ds.loadAliases(this.tuneID);
//             this.aliases = aliases.map(a => utils.parseDisplayableName(a));
//             if (this.aliases.length > 0) {
//                 this.noAliases = false;
//             }

//             this.empty = false;
//         } else {
//             this.empty = true;
//         }

//         // Auto-pop open the matched setting and scroll into view
//         if (!this.empty) {
//             if (this.settingID) {
//                 for (const [i, setting] of this.settings.entries()) {
//                     if (setting.setting === this.settingID) {
//                         this.expandedIndex = [i];
//                     }
//                 }
//             } else {
//                 // By default, open the first tune. Only pop it open
//                 //  here because otherwise if it's in data() the first
//                 //  one pops open unwanted even when we've hit another
//                 //  as above.
//                 this.expandedIndex = [0];
//             }
//         }
//     },
//     methods: {
//         descriptor: function (setting) {
//             return utils.parseDisplayableDescription(setting);
//         }
//     },
//     props: {
//         settingID: null,
//         tuneID: null
//     }
// };
</script>

<style scoped>
.descriptor::first-letter {
    text-transform: uppercase;
    display: inline-block;
}

.tune {
    max-width: 100vh;
}
</style>