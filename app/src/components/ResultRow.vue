<template>
    <router-link
        :to="{
            name: 'tune',
            params: {
                settingID: settingID,
                tuneID: setting.tune_id,
                displayName: displayName,
            },
        }"
    >
        <v-container
            v-ripple
            @click="addToHistory"
        >
            <v-row class="pt-1 pb-0">
                <v-col class="py-0">
                    <h2>{{ name }}</h2>
                </v-col>
            </v-row>
            <v-row class="pb-2 pt-0">
                <v-col class="py-0 descriptor">
                    {{ descriptor }}
                </v-col>
                <v-col
                    v-show="score"
                    class="py-0 text-right score"
                    :style="`color: ${scoreColour};`"
                >
                    {{ scoreLabel }}
                </v-col>
            </v-row>
        </v-container>
    </router-link>
</template>

<script>
import utils from '@/js/utils.js';
import store from '@/services/store.js';
import {HistoryItem} from '@/js/schema';

export default {
    name: 'ResultRow',
    props: {
        setting: {
            type: Object,
            required: true
        },
        displayName: {
            type: String,
            required: true
        },
        settingID: {
            type: String,
            default: null,
            required: false
        },
        score: {
            type: Number,
            default: null,
            required: false
        }
    },

    computed: {
        descriptor: function () {
            return utils.parseDisplayableDescription(this.setting);
        },
        name: function () {
            // Allow the result object being passed in to override this
            //  default behaviour. If we are doing text searches we want
            //  to display the matched alias which isn't necessarily the
            //  name.
            return utils.parseDisplayableName(this.displayName);
        },
        scoreLabel: function () {
            // This mapping is a rough guideline based on experience
            //  testing FolkFriend and how often certain scores correspond
            //  to an accurate match. Added this in response to user feedback
            //  from multiple people who consistently said the scores were
            //  inaccurate and they wished FolkFriend was a bit more confident.
            //  Also if the recording is rubbish and it comes up with very poor
            //  matches now they will be flagged up as unlikely.
            if (this.score > 0.65) {
                return 'Very Close';
            } else if (this.score > 0.5) {
                return 'Close';
            } else if (this.score > 0.2) {
                return 'Possible';
            } else if (this.score > 0) {
                return 'Unlikely';
            } else {
                return 'No Match';
            }
        },
        scoreColour: function () {
            let x = this.score;
            x = Math.min(0.7, x);
            x = Math.max(0.0, x);
            x = x / 0.7;

            const a = '#CC1111';
            const b = '#11CC11';
            return utils.lerpColor(a, b, x);
        },
    },
    methods: {
        addToHistory() {
            store.addToHistory(new HistoryItem({
                settingID: this.settingID,
                setting: this.setting,
                displayName: this.displayName,
            }));
        },
    },
};
</script>

<style scoped>
.descriptor {
  font-style: italic;
}

.descriptor::first-letter {
  text-transform: uppercase;
}

.score {
  font-weight: bolder;
  font-style: italic;
}

.resultsTable a {
  text-decoration: none;
  color: inherit;
}

.resultsTable a div {
  background: inherit;
}
</style>