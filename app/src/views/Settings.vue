<template>
    <v-container>
        <h1 class="my-2">
            Settings
        </h1>
        <!-- <h3>TODO Select microphone</h3> -->
        <v-container class="mx-auto px-5">
            <v-row>
                <v-switch
                    v-model="userSettings.preferFileUpload"
                    inset
                    label="Upload file instead of using device microphone"
                    class="my-0"
                    @change="settingsChanged"
                />
            </v-row>
            <v-row>
                <v-switch
                    v-model="userSettings.advancedMode"
                    inset
                    label="Removes time limit on microphone and generates sheet music without searching database"
                    class="my-0"
                    @change="settingsChanged"
                />
            </v-row>
            <v-row>
                <v-switch
                    v-model="userSettings.showAbcText"
                    inset
                    label="Show ABC as text alongside sheet music"
                    class="my-0"
                    @change="settingsChanged"
                />
            </v-row>
        </v-container>
    </v-container>
</template>

<script>
import store from '@/services/store.js';
import eventBus from '@/eventBus';

export default {
    name: 'SettingsView',
    data: () => ({
        settingsLoaded: false,
        userSettings: store.userSettings,
    }),
    created: function () {
        eventBus.$emit('parentViewActivated');
    },
    methods: {
        settingsChanged() {
            store.updateUserSettings(this.userSettings);
        },
    },
};
</script>

<style scoped>
</style>