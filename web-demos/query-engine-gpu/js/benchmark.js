window.addEventListener("load", benchmark);

let cooley = [92,  84,  92,  84,  76, 104,  92,  92,  92,  96,
       104, 112, 120, 124, 104,  92,  92,  92,  92,  84,  92,  84,  76,
       112,  84,  84, 104,  92,  76,  84,  84, 112, 104,  92,  92,  92,
        92,  84,  92,  84,  76, 104,  92,  92,  92,  96, 104, 112, 120,
       124, 104,  92,  92,  92,  92,  84,  92];
console.log(cooley.length);

function benchmark() {
    fetchShaderResources().then(resources => {
        console.log(resources);
        // document.body.appendChild(resources.fragment);
        const qe = new QueryEngineGPU(
            resources.vertexShader,
            resources.fragmentShader,
            resources.fragment
        );

        document.getElementById("execute").addEventListener("click", () => {
            console.time('execute');
            let arrs = qe.execute(cooley);
            console.timeEnd('execute');
        });

        console.time("initialise");
        qe.initialise();
        console.timeEnd("initialise");
    }).catch(console.error);
}

function fetchShaderResources() {
    // TODO load in multiple fragments
    // let fragmentPromise = loadFragmentsAsync("/small-data.png");
    // let fragmentPromise = loadFragmentsAsync("/long-data.png");
    // let fragmentPromise = loadFragmentsAsync("/64x64.png");
    // let fragmentPromise = loadFragmentsAsync("/1024x1024.png");
    let fragmentPromise = loadFragmentsAsync("/2048x2048.png");
    // let fragmentPromise = loadFragmentsAsync("/dummy_shards.png");

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