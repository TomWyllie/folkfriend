window.addEventListener("load", benchmark);

function benchmark() {
    fetchShaderResources().then(resources => {
        console.log(resources);
        // document.body.appendChild(resources.fragment);
        const qe = new QueryEngineGPU(
            resources.vertexShader,
            resources.fragmentShader,
            resources.fragment
        );
        console.debug("initialise");
        qe.initialise();


    }).catch(console.error);
}

// Old iOS doesn't support async / await keywords ...
function fetchShaderResources() {
    // TODO load in multiple fragments
    let fragmentPromise = loadFragmentsAsync("/small-data.png");

    return new Promise(resolve => {
        Promise.all([
            loadShaderAsync("shaders/vertex.glsl"),
            loadShaderAsync("shaders/fragment.glsl"),
            fragmentPromise
        ]).then(responses => {
            resolve({
                vertexShader: responses[0],
                fragmentShader: responses[1],
                fragment: responses[2]
            });
        }).catch(console.error);
    });
}

function loadShaderAsync(shader) {
    return fetch(shader)
        .then(value => value.text());
}

function loadFragmentsAsync(fragment) {
    // Fragment is a URL to a .png file
    let image = new Image();
    return new Promise(resolve => {
        image.src = fragment;
        image.onload = () => resolve(image);
    });
}