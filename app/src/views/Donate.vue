<template>
    <v-container 
        class="viewContainerWrapper"
    >
        <h1 class="my-2">
            Donate
        </h1>
        <iframe 
            src="https://donorbox.org/embed/help-support-development-of-folkfriend" 
            name="donorbox" 
            allowpaymentrequest="allowpaymentrequest" 
            seamless="seamless" 
            frameborder="0" 
            scrolling="no" 
            height="900px" 
            width="100%" 
            style="max-width: 500px; min-width: 250px; max-height:none!important; margin: auto;" 
        />
    </v-container>
</template>

<script>
            // style="max-width: 500px; min-width: 250px; max-height:none!important" 

export default {
    name: 'DonateView',
};
</script>

<style scoped>


</style>