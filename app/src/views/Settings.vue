<template>
    <v-container 
        class="viewContainerWrapper"
    >
        <v-card
            class="pa-5 my-2"
        >
            <h1 class="pb-3">
                Settings
            </h1>
            <v-row>
                <v-switch
                    v-model="userSettings.preferFileUpload"
                    inset
                    label="Upload file instead of using device microphone"
                    class="my-0 pl-2"
                    @change="settingsChanged"
                />
            </v-row>
            <v-row>
                <v-switch
                    v-model="userSettings.advancedMode"
                    inset
                    label="Removes time limit on microphone and generates sheet music without searching database"
                    class="my-0 pl-2"
                    @change="settingsChanged"
                />
            </v-row>
            <v-row>
                <v-switch
                    v-model="userSettings.showAbcText"
                    inset
                    label="Show ABC as text alongside sheet music"
                    class="my-0 pl-2"
                    @change="settingsChanged"
                />
            </v-row>
        </v-card>
        <v-card
            class="pa-5 my-2"
        >
            <h1>Download</h1>
            <p>
                FolkFriend is a "Web App", which means it installs onto your
                Home Screen just like any other app.
            </p>
            <p
                v-if="isPWA"
                align="center"
            >
                FolkFriend is installed <v-icon class="pb-1 Installed">
                    {{ icons.checkCircle }}
                </v-icon>
            </p>
            <p v-else-if="ua.isSafari && ua.isMobile">
                On iOS Safari,
                <ul>
                    <li>
                        Tap <v-icon class="pb-2">
                            {{ icons.iosShare }}
                        </v-icon> "share"
                    </li>
                    <li>Scroll down</li>
                    <li>
                        Tap <v-icon class="pb-1">
                            {{ icons.iosAddToHomeScreen }}
                        </v-icon> "add to home screen"
                    </li>
                </ul>
            </p>
            <p v-else-if="ua.isChrome && ua.isMobile">
                On Chrome mobile,
                <ul>
                    <li>
                        Tap <v-icon class="pb-1">
                            {{ icons.dotsVertical }}
                        </v-icon> "Customise"
                    </li>
                    <li>
                        Tap <v-icon class="pb-1">
                            {{ icons.installMobile }}
                        </v-icon> "Install FolkFriend"
                    </li>
                </ul>
            </p>
            <p v-else-if="ua.isChrome && !ua.isMobile">
                On Chrome desktop,
                <ul>
                    <li>
                        Tap <v-icon class="pb-1">
                            {{ icons.installDesktop }}
                        </v-icon> "install app"
                    </li>
                </ul>
            </p>
            <p v-else>
                To install FolkFriend, navigate to the settings of your browser
                and select "Add to Home Screen" or "Install App".
            </p>
        </v-card>
    </v-container>
</template>

<script>
import store from '@/services/store.js';
import eventBus from '@/eventBus';
import utils from '@/js/utils.js';
import {
    // mdiCellphoneArrowDownVariant,
    mdiCellphoneArrowDown,
    mdiCheckCircleOutline,
    mdiDotsVertical,
    mdiExportVariant,
    // mdiMonitorArrowDownVariant,
    mdiPlusBoxOutline,
} from '@mdi/js';

export default {
    name: 'SettingsView',
    beforeRouteEnter(_, from, next) {
        // This becomes a parent view, unless it's come from the search,
        //  in which case the hamburger state isn't changed. This enables
        //  it to stay as a parent view if the settings were opened through
        //  the navigation drawer, or to become a child view if the top-right
        //  settings shortcut was clicked from the search page.
        if(from.name !== 'search') {
            eventBus.$emit('parentViewActivated');
        }        
        next();
    },
    data: () => ({
        icons: {
            iosShare: mdiExportVariant,
            iosAddToHomeScreen: mdiPlusBoxOutline,
            checkCircle: mdiCheckCircleOutline,
            // TODO waiting on these icons being pushed to the npm version
            // installDesktop: mdiMonitorArrowDownVariant,
            // installMobile: mdiCellphoneArrowDownVariant,
            installDesktop: mdiCellphoneArrowDown,
            installMobile: mdiCellphoneArrowDown,
            dotsVertical: mdiDotsVertical,
        },
        settingsLoaded: false,
        userSettings: store.userSettings,
        isPWA: utils.checkStandalone(),
    }),
    created: function() {
        this.ua = utils.checkUserAgent();
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