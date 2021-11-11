import Vue from 'vue';
import VueRouter from 'vue-router';
import Search from '@/views/Search.vue';
import Notes from '@/views/Notes.vue';
import Results from '@/views/Results.vue';
import Tune from '@/views/Tune.vue';
import Settings from '@/views/Settings.vue';
import History from '@/views/History.vue';
import Help from '@/views/Help.vue';

Vue.use(VueRouter);

const routes = [{
        path: '/',
        name: 'search',
        component: Search
    },
    {
        path: '/notes',
        name: 'notes',
        component: Notes
    },
    {
        path: '/results',
        name: 'results',
        component: Results
    },
    {
        path: '/tune',
        name: 'tune',
        component: Tune,
        props: true
    },
    {
        path: '/history',
        name: 'history',
        component: History
    },
    {
        path: '/settings',
        name: 'settings',
        component: Settings
    },
    {
        path: '/help',
        name: 'help',
        component: Help,
        props: true
    }
];

/* From both of "results" and "history" we can load a tune from the table
   which will be on its own page but can't be loaded directly. When viewing
   a tune the hamburger will change to a back arrow which will return the
   user to whichever page they came from. */

const router = new VueRouter({
    mode: 'history',
    // eslint-disable-next-line no-undef
    base: process.env.BASE_URL,
    routes
});

export default router;