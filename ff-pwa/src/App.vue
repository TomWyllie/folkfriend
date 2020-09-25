<template>
    <div id="app">
        <div id="nav">
            <router-link to="/">Home</router-link>
            |
            <router-link to="/about">About</router-link>
        </div>
        <router-view/>
    </div>
</template>

<script>

import ds from './services/database.worker';
import transcriber from "@/folkfriend/ff-transcriber.worker";
import queryEngine from "@/folkfriend/ff-query-engine";

async function readyServices() {
    // Order non-trivial here, we initialise things likely
    //  to be needed sooner, first.
    const start = Date.now();
    await transcriber.initialise();
    console.debug(`Transcriber ready in ${Date.now() - start} ms`);
    await ds.initialise();
    console.debug(`Database worker ready in ${Date.now() - start} ms`);
    await queryEngine.initialise();
    console.debug(`Query engine ready in ${Date.now() - start} ms`);
    console.debug(`All services ready in ${Date.now() - start} ms`);
}

readyServices().then();
export default {};

</script>

<style>
#app {
    font-family: Avenir, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-align: center;
    color: #2c3e50;
}

#nav {
    padding: 30px;
}

#nav a {
    font-weight: bold;
    color: #2c3e50;
}

#nav a.router-link-exact-active {
    color: #42b983;
}
</style>
