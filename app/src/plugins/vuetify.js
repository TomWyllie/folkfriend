import Vue from 'vue';
import Vuetify from 'vuetify/lib/framework';

Vue.use(Vuetify);

const opts = {
    theme: {
        options: {
            customProperties: true,
        },
        themes: {
            light: {
                primary: '#055581',
                secondary: '#FF3B3F',
                accent: '#3585C1',
                error: '#B71C1C',
            },
        },
    },
    icons: {
        iconfont: 'mdiSvg',
    },
};

export default new Vuetify(opts);