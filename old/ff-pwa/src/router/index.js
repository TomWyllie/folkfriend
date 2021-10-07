import Vue from 'vue';
import VueRouter from 'vue-router';
import Record from '@/views/Record.vue';
import Transcriptions from '@/views/Transcriptions.vue';
import Searches from '@/views/Searches';
import Tune from "@/views/Tune";
import Settings from "@/views/Settings";
import History from "@/views/History";

Vue.use(VueRouter);

const routes = [
    {
        path: '/',
        name: 'record',
        component: Record
    },
    // {
    //     path: '/about',
    //     name: 'About',
    //     // route level code-splitting
    //     // this generates a separate chunk (about.[hash].js) for this route
    //     // which is lazy-loaded when the route is visited.
    //     component: () => import(/* webpackChunkName: "about" */ '../views/About.vue')
    // }
    {
        path: '/transcriptions',
        name: 'transcriptions',
        component: Transcriptions,
    },
    {
        path: '/searches',
        name: 'searches',
        component: Searches,
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
        component: History,
    },
    {
        path: '/settings',
        name: 'settings',
        component: Settings,
    },
];

/* For both of "transcriptions" and "searches" we have a single item that can
*   be loaded from the table which will be on it's own page ("transcription"
*   or "tune" which changes the hamburger to a back button and can't be viewed
*   directly. History buttons will point to one of these two views.*/

const router = new VueRouter({
    mode: 'history',
    base: process.env.BASE_URL,
    routes
});

export default router;



