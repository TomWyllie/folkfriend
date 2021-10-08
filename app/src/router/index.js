import Vue from 'vue'
import VueRouter from 'vue-router'
import Record from '@/views/Record.vue';
import Transcriptions from '@/views/Transcriptions.vue';
import Searches from '@/views/Searches';
import Tune from "@/views/Tune";
import Settings from "@/views/Settings";
import History from "@/views/History";

Vue.use(VueRouter)

const routes = [
    {
        path: '/',
        name: 'record',
        component: Record
    },
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
    }
];

const router = new VueRouter({
    mode: 'history',
    base: process.env.BASE_URL,
    routes
})

export default router
