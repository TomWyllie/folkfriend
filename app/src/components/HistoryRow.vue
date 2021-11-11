<template>
    <v-container
        v-ripple
        @click="historyItemClicked"
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
                class="py-0 text-right timestamp"
            >
                {{ timestampString }}
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
import utils from '@/js/utils';

export default {
    name: 'HistoryRow',
    props: {
        name: {
            type: String,
            required: true
        },
        descriptor: {
            type: String,
            required: true
        },
        timestamp: {
            type: Number,
            required: true
        }
    },
    computed: {
        timestampString() {
            return utils.utcToString(this.timestamp);
        }
    },
    methods: {
        historyItemClicked() {
            this.$emit('historyItemClicked', this.timestamp);
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

.resultsTable a {
  text-decoration: none;
  color: inherit;
}

.resultsTable a div {
  background: inherit;
}
</style>