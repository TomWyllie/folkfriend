<template>
    <v-container class="tune mx-auto" v-if="!empty">
        <h1
            class="my-2"
            :style="`color:${this.$vuetify.theme.currentTheme.secondary};`"
        >
            {{ this.name }}
        </h1>
        <v-container class="my-1" v-show="displayableAliases.length">
            <span class="font-italic text--secondary">Also known as: </span>
            <v-chip
                v-for="alias in this.displayableAliases"
                :key="alias"
                class="nameChip ma-1"
                label
                small
                >{{ alias }}
            </v-chip>
        </v-container>
        <v-expansion-panels
            v-model="expandedIndex"
            v-bind:class="{ abcFullScreen: abcFullScreen }"
            multiple
        >
            <v-expansion-panel
                v-show="settings"
                v-for="settingData in this.settings"
                :key="settingData.setting_id"
                :setting="settingData"
            >
                <v-expansion-panel-header>
                    <h3 class="descriptor font-weight-medium">
                        {{
                            `${settingData.dance} in ${settingData.mode.slice(
                                0,
                                4
                            )}`
                        }}
                    </h3>
                </v-expansion-panel-header>
                <v-expansion-panel-content>
                    <AbcDisplay
                        :abc="settingData.abc"
                        :mode="settingData.mode"
                        :meter="settingData.meter"
                        @abcGoFullScreen="abcGoFullScreen"
                        @abcExitFullScreen="abcExitFullScreen"
                    ></AbcDisplay>
                    <!-- <div>placeholder ABC display</div> -->
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
import utils from "@/services/utils.js";
import AbcDisplay from "@/components/AbcDisplay";
import ffBackend from "@/services/backend.js";
import eventBus from "@/eventBus";

export default {
    name: "Tune",
    data: function () {
        return {
            // Important it starts empty otherwise we see it flash very
            //  briefly on load.
            empty: false,

            settings: null,
            name: null,
            displayableAliases: [],
            abcFullScreen: false,

            expandedIndex: [],
        };
    },
    components: { AbcDisplay },

    created: async function () {
        eventBus.$emit("childViewActivated");

        if (typeof this.tuneID === "undefined") {
            return;
        }

        this.settings = await ffBackend.settingsFromTuneID(this.tuneID);
        let aliases = await ffBackend.aliasesFromTuneID(this.tuneID);

        let primaryAliasIndex = 0;

        if (typeof this.displayName !== "undefined") {
            primaryAliasIndex = aliases.indexOf(this.displayName);
            if (primaryAliasIndex == -1) {
                console.warn("Display name was not found in aliases!");
            }
        }

        this.displayableAliases = aliases.map((a) =>
            utils.parseDisplayableName(a)
        );
        this.name = this.displayableAliases.pop(primaryAliasIndex);

        // Auto-pop open the matched setting and scroll into view
        // TODO auto pop open
        // if (!this.empty) {
        if (this.settingID) {
            for (const [i, setting] of this.settings.entries()) {
                if (setting.setting === this.settingID) {
                    this.expandedIndex = [i];
                    console.debug(this.expandedIndex);
                }
            }
        } else {
            // By default, open the first tune. Only pop it open
            //  here because otherwise if it's in data() the first
            //  one pops open unwanted even when we've hit another
            //  as above.
            this.expandedIndex = [0];
        }
        // }
    },
    methods: {
        descriptor: function (setting) {
            return utils.parseDisplayableDescription(setting);
        },
        abcGoFullScreen: function () {
            this.abcFullScreen = true;
        },
        abcExitFullScreen: function () {
            this.abcFullScreen = false;
        },
    },
    props: {
        tuneID: null,
        settingID: null,
        displayName: null,
    },
};
</script>

<style scoped>
.descriptor::first-letter {
    text-transform: uppercase;
    display: inline-block;
}

.tune {
    max-width: 100vh;
}

.abcFullScreen {
    z-index: 8;
}
</style>