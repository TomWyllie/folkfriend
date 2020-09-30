<template>
    <p>
        {{ this.setting }}
        {{ this.tune }}
    </p>
</template>

<script>
export default {
    name: "Tune",
    props: {
        setting: null,
        tune: null
    }
};
</script>

<style scoped>

</style>