<template>
    <v-card>
        <h1>{{ this.result.name}}</h1>
        <h3>{{ this.result.type}}</h3>
        <h3>{{ this.result.mode}}</h3>
        <h3>{{ this.result.meter}}</h3>
        <span>{{ this.result.abc }}</span>
        <AbcDisplay
            :abc="this.result.abc"
        ></AbcDisplay>
    </v-card>
</template>

<script>
import AbcDisplay from "@/components/AbcDisplay";

export default {
    name: "ResultRow",
    components: {AbcDisplay},
    props: ['result']
};
</script>

<style scoped>

</style>