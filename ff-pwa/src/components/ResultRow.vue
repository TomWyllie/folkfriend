<template>
    <router-link tag="div"
                 :to="{ name: 'tune',
                        params: {
                            settingID: this.result.setting,
                            tuneID: this.result.tune
                        }
                 }">
        <v-container v-ripple>
            <v-row>
                <v-col class="py-0">
                    <h2>{{ this.name }}</h2>
                </v-col>
            </v-row>
            <v-row>
                <v-col class="py-0 descriptor">
                    {{ this.descriptor }}
                </v-col>
                <v-col class="py-0 text-right score" :style="`color: ${this.scoreColour};`">
                    {{ this.score }}
                </v-col>
            </v-row>
        </v-container>
    </router-link>
</template>

<script>
import utils from "@/folkfriend/ff-utils";

export default {
    name: 'ResultRow',
    props: ['result'],
    computed: {
        descriptor: function () {
            return utils.parseDisplayableDescription(this.result);
        },
        name: function () {
            return utils.parseDisplayableName(this.result.name);
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
                return 'Very Close Match';
            } else if (this.result.score > 0.50) {
                return 'Close Match';
            } else if (this.result.score > 0.32) {
                return 'Possible Match';
            } else if (this.result.score > 0.20) {
                return 'Unlikely Match';
            } else {
                return 'Very Unlikely Match';
            }
        },
        scoreColour: function () {
            let x = this.result.score;
            x = Math.min(0.7, x);
            x = Math.max(0.0, x);
            x = (x - 0.1) / 0.7;

            // const a = this.$vuetify.theme.currentTheme.error;
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