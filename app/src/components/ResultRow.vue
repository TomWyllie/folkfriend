<template>
    <router-link
        tag="div"
        :to="{
            name: 'tune',
            params: {
                settingID: this.result.setting_id,
                tuneID: this.result.setting.tune_id,
                displayName: this.result.display_name
            },
        }"
    >
        <v-container v-ripple>
            <v-row class="pt-1 pb-0">
                <v-col class="py-0">
                    <h2>{{ this.name }}</h2>
                </v-col>
            </v-row>
            <v-row class="pb-2 pt-0">
                <v-col class="py-0 descriptor">
                    {{ this.descriptor }}
                </v-col>
                <v-col
                    v-show="this.result.score"
                    class="py-0 text-right score"
                    :style="`color: ${this.scoreColour};`"
                >
                    {{ this.score }}
                </v-col>
            </v-row>
        </v-container>
    </router-link>
</template>

<script>
import utils from "@/services/utils";

export default {
    name: 'ResultRow',
    props: ['result'],
    computed: {
        descriptor: function () {
            return utils.parseDisplayableDescription(this.result.setting);
        },
        name: function () {
            // Allow the result object being passed in to override this
            //  default behaviour. If we are doing text searches we want
            //  to display the matched alias which isn't necessarily the
            //  name.
            return utils.parseDisplayableName(this.result.display_name);
        },
        score: function () {
            // This mapping is a rough guideline based on experience
            //  testing FolkFriend and how often certain scores correspond
            //  to an accurate match. Added this in response to user feedback
            //  from multiple people who consistently said the scores were
            //  inaccurate and they wished FolkFriend was a bit more confident.
            //  Also if the recording is rubbish and it comes up with very poor
            //  matches now they will be flagged up as unlikely.
            if (this.result.score > 0.7) {
                return 'Very Close';
            } else if (this.result.score > 0.50) {
                return 'Close';
            } else if (this.result.score > 0.32) {
                return 'Possible';
            } else if (this.result.score > 0.20) {
                return 'Unlikely';
            } else if (this.result.score > 0){
                return 'Very Unlikely';
            } else {
                return 'No Match'
            }
        },
        scoreColour: function () {
            let x = this.result.score;
            x = Math.min(0.7, x);
            x = Math.max(0.0, x);
            x = (x - 0.1) / 0.7;

            const a = '#CC1111';
            const b = '#11CC11';
            return utils.lerpColor(a, b, x);
        }
    }
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
</style>