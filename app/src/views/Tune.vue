<template>
    <v-container
        v-if="name"
        class="tune mx-auto"
    >
        <h1 class="my-1">
            {{ name }}
        </h1>

        <v-container
            v-if="displayableAliases.length"
            class="mt-0 mb-2 py-0"
        >
            <span class="akaSpan pl-2 pr-1">Also known as</span>
            <v-chip
                v-for="alias in displayableAliases"
                :key="alias"
                class="ma-1 px-2"
                small
            >
                {{ alias }}
            </v-chip>
            <v-chip
                small
                class="sourceChip ma-1 px-2"
                @click="sourceClicked"
            >
                Source&nbsp;<v-icon small>
                    {{ icons.openInNew }}
                </v-icon>
            </v-chip>
        </v-container>
        <v-container
            v-else
            class="mt-0 mb-2 py-0"
        >
            <v-chip
                small
                class="sourceChip ma-1 px-2 py-2"
                @click="sourceClicked"
            >
                Source&nbsp;<v-icon small>
                    {{ icons.openInNew }}
                </v-icon>
            </v-chip>
        </v-container>

        <v-expansion-panels
            ref="expansionPanels"
            v-model="expandedIndex"
            :class="{ abcFullScreen: abcFullScreen }"
            multiple
        >
            <v-expansion-panel
                v-for="settingData in settings"
                :key="settingData.setting_id"
                class="expansionPanel"
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
                        @abcRendered="scrollIntoView"
                    />
                </v-expansion-panel-content>
            </v-expansion-panel>
        </v-expansion-panels>
    </v-container>
    <!-- This actually shouldn't ever happen unless the user manually navigates to /tunes -->
    <v-container v-else-if="!tuneID">
        <p class="px-10">
            No tune loaded. Please search for a tune.
        </p>
    </v-container>
</template>

<script>
import utils from '@/js/utils.js';
import AbcDisplay from '@/components/AbcDisplay';
import ffBackend from '@/services/backend.js';
import eventBus from '@/eventBus';
import abcjs from 'abcjs/midi';
import {
    mdiOpenInNew,
} from '@mdi/js';
export default {
    name: 'TuneView',
    components: { AbcDisplay },
    props: {
        tuneID: {
            type: String,
            required: false,
            default: ''
        },
        displayName: {
            type: String,
            required: false,
            default: ''
        },
        settingID: {
            type: String,
            required: false,
            default: null
        },
    },
    data: function () {
        return {
            settings: null,
            name: null,
            displayableAliases: [],
            abcFullScreen: false,

            expandedIndex: [],

            icons: {
                openInNew: mdiOpenInNew
            },
            sourceTheSession: `https://thesession.org/tunes/${this.tuneID}`
        };
    },
    created: async function () {
        eventBus.$emit('childViewActivated');

        if (this.tuneID === '') {
            return;
        }

        this.settings = await ffBackend.settingsFromTuneID(this.tuneID);
        let aliases = await ffBackend.aliasesFromTuneID(this.tuneID);

        let primaryAliasIndex = 0;

        if (typeof this.displayName !== 'undefined') {
            primaryAliasIndex = aliases.indexOf(this.displayName);
            if (primaryAliasIndex == -1) {
                console.warn('Display name was not found in aliases!');
                primaryAliasIndex = 0;
            }
        }

        this.displayableAliases = aliases.map((a) =>
            utils.parseDisplayableName(a)
        );
        this.name = this.displayableAliases.splice(primaryAliasIndex, 1)[0];

        // Auto-pop open the matched setting and scroll into view
        if (this.settingID) {
            for (const [i, setting] of this.settings.entries()) {
                if (setting.setting_id === this.settingID) {
                    this.expandedIndex = [i];
                }
            }
        } else {
            // By default, open the first tune. Only pop it open
            //  here because otherwise if it's in data() the first
            //  one pops open unwanted even when we've hit another
            //  as above.
            this.expandedIndex = [0];
        }

        // Stop any MIDI tracks that might be playing already
        abcjs.midi.stopPlaying();

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
        scrollIntoView: function() {
            // If it's a couple of tunes down then help the user by scrolling
            //  the setting into view.
            let expandedIndex = this.expandedIndex[0];
            if(expandedIndex && expandedIndex >= 3) {
                let panels = this.$refs.expansionPanels;
                panels.$children[expandedIndex].$el.scrollIntoView();
            }
        },
        sourceClicked: function() {
            window.open(this.sourceTheSession);
        }
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

h1 {
    font-size: x-large;
}

.expansionPanel {
    scroll-margin-top: 60px;
}

.sourceChip {
    font-style: italic;
}

.akaSpan {
    font-size: smaller;
    font-style: italic;
}

</style>