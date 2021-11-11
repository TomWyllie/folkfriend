<template>
    <v-container>
        <h1>History</h1>
        <v-list class="resultsTable">
            <HistoryRow
                v-for="historyRow in historyRowsProps"
                :key="`${historyRow.timestamp}`"
                :name="historyRow.name"
                :descriptor="historyRow.descriptor"
                :timestamp="historyRow.timestamp"
                @historyItemClicked="loadHistoryItem"
            />
        </v-list>
    </v-container>
</template>

<script>
import eventBus from '@/eventBus';
import store from '@/services/store';
import HistoryRow from '@/components/HistoryRow';
import utils from '@/js/utils';
import router from '@/router/index.js';

export default {
    name: 'HistoryView',
    components: {
        HistoryRow,
    },
    data: function() {
        return {
            historyItems: [],
            historyRowsProps: [],
        }; 
    },
    created: function () {
        eventBus.$emit('parentViewActivated');
        store.getHistoryItems().then((historyItems) => {
            this.historyItems = historyItems;
            this.historyRowsProps = historyItems.map((historyItem) => {
                if(historyItem.result.contour) {
                    return {
                        name: 'Recording',
                        descriptor: 'Notes from audio',
                        timestamp: historyItem.timestamp,
                    };
                }
                return {
                    name: utils.parseDisplayableName(historyItem.result.displayName),
                    descriptor: utils.parseDisplayableDescription(historyItem.result.setting),
                    timestamp: historyItem.timestamp,
                };
            });
        });
    },
    methods: {
        loadHistoryItem(timestamp) {
            for(let historyItem of this.historyItems) {
                // Assume timestamps are unique. There's near-millisecond
                //  resolution so in practice it always should be.
                if(historyItem.timestamp === timestamp) {
                    const result = historyItem.result;
                    if(result.contour) {
                        store.state.lastContour = result.contour;
                        router.push({
                            name: 'notes'
                        });
                        eventBus.$emit('childViewActivated');
                    } else {
                        router.push({
                            name: 'tune',
                            params: {
                                tuneID: result.setting.tune_id,
                                settingID: result.settingID,
                                displayName: result.displayName
                            }
                        });
                    }
                }
            }
        }
    }
};
</script>

<style scoped>
.resultsTable > div:nth-child(odd) {
    background: #efefef;
}
</style>