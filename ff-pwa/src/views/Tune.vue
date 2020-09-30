<template>
    <v-container>
        <v-expansion-panels
            v-if="!empty"
        >
            <v-expansion-panel
                v-show="settings"
                v-for="settingData in this.settings"
                :key="settingData.setting"
                :setting="settingData"
            >
                <v-expansion-panel-header class="descriptor">
                    {{ `${settingData.type} in ${settingData.mode.slice(0, 4)}` }}
                </v-expansion-panel-header>
                <v-expansion-panel-content>
                    <p>{{ settingData.abc }}</p>
                </v-expansion-panel-content>
            </v-expansion-panel>
        </v-expansion-panels>
        <p
            v-else
        >No tune loaded. Please search for a tune.</p>

    </v-container>
    <!--    <p>-->
    <!--        {{ this.settingID }}-->
    <!--        {{ this.tuneID }}-->
    <!--    </p>-->
</template>

<script>
import ds from "@/services/database.worker";
import utils from "@/folkfriend/ff-utils";

export default {
    name: "Tune",
    data: function () {
        return {
            settings: null,
            // Important it starts empty otherwise we see it flash very
            //  briefly on load.
            empty: false
        };
    },
    mounted: async function() {
        if(this.tuneID) {
            this.settings = await ds.loadTune(this.tuneID);
            this.empty = false;
        } else {
            this.empty = true;
        }
    },
    methods: {
        descriptor: function (setting) {
            return utils.parseDisplayableDescription(setting);
        }
    },
    props: {
        settingID: null,
        tuneID: null
    }
};
</script>

<style scoped>
.descriptor::first-letter {
    text-transform: uppercase;
}
</style>