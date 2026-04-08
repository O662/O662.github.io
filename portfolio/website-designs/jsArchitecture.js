const MODEL_URL = "/Images/architecture/Cottage.glb";
const LOCAL_THREE_PATH = "/js/vendor/three/three.module.js";
const LOCAL_GLTF_LOADER_PATH = "/js/vendor/three/GLTFLoader.js";
const SCROLL_SPIN_PORTION = 0.65;
const SCROLL_ZOOM_PORTION = 1 - SCROLL_SPIN_PORTION;

const canvas = document.getElementById("architecture-canvas");
const experienceSection = document.querySelector(".architecture-experience");
const statusEl = document.getElementById("experience-status");

if (!canvas || !experienceSection) {
    console.warn("Architecture experience canvas or section not found.");
}

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (prefersReducedMotion && statusEl) {
    statusEl.textContent = "Reduced motion enabled - showing a static view.";
}

let renderer;
let scene;
let camera;
let model;
let modelRoot;
let startCameraPosition;
let endCameraPosition;
let targetPosition;
let initialRotationY = 0;
let needsRender = true;

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function updateStatus(message) {
    if (statusEl) {
        statusEl.textContent = message;
    }
}

function getScrollProgress() {
    const sectionTop = experienceSection.offsetTop;
    const sectionHeight = experienceSection.offsetHeight;
    const viewportHeight = window.innerHeight;
    const scrollY = window.scrollY || window.pageYOffset;
    const maxScroll = sectionHeight - viewportHeight;
    if (maxScroll <= 0) {
        return 0;
    }
    return clamp((scrollY - sectionTop) / maxScroll, 0, 1);
}

function updateAnimation() {
    if (!renderer || !scene || !camera) {
        return;
    }

    if (prefersReducedMotion && modelRoot) {
        renderer.render(scene, camera);
        return;
    }

    if (!modelRoot || !startCameraPosition || !endCameraPosition) {
        renderer.render(scene, camera);
        return;
    }

    const progress = getScrollProgress();
    const spinProgress = clamp(progress / SCROLL_SPIN_PORTION, 0, 1);
    const zoomProgress = clamp((progress - SCROLL_SPIN_PORTION) / SCROLL_ZOOM_PORTION, 0, 1);

    modelRoot.rotation.y = initialRotationY + spinProgress * Math.PI * 2;
    camera.position.lerpVectors(startCameraPosition, endCameraPosition, zoomProgress);
    camera.lookAt(targetPosition);

    renderer.render(scene, camera);
}

function onResize() {
    if (!renderer || !camera) {
        return;
    }
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    needsRender = true;
}

function onScroll() {
    needsRender = true;
}

function animate() {
    if (needsRender) {
        updateAnimation();
        needsRender = false;
    }
    requestAnimationFrame(animate);
}

function setupScene(THREE) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f0ea);

    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;

    camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 2000);
    camera.position.set(0, 1.2, 6);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
    keyLight.position.set(5, 10, 7);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
    fillLight.position.set(-6, 3, -4);
    scene.add(fillLight);
}

function frameModel(THREE, object3d) {
    const box = new THREE.Box3().setFromObject(object3d);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    object3d.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 2.4;
    const elevation = Math.max(size.y * 0.2, 0.6);

    targetPosition = new THREE.Vector3(0, 0, 0);

    startCameraPosition = new THREE.Vector3(0, elevation, distance);

    const entryDepth = Math.max(maxDim * 0.35, 0.8);
    endCameraPosition = new THREE.Vector3(0, elevation * 0.5, entryDepth);

    camera.position.copy(startCameraPosition);
    camera.lookAt(targetPosition);
}

function loadModel(THREE, GLTFLoader) {
    const loader = new GLTFLoader();
    updateStatus("Loading model...");

    loader.load(
        MODEL_URL,
        (gltf) => {
            model = gltf.scene;
            modelRoot = model;
            scene.add(model);
            frameModel(THREE, model);
            updateStatus("Scroll to rotate and enter the house.");
            needsRender = true;
        },
        (event) => {
            if (event.lengthComputable) {
                const progress = Math.round((event.loaded / event.total) * 100);
                updateStatus(`Loading model... ${progress}%`);
            }
        },
        (error) => {
            console.error("GLB load error:", error);
            updateStatus("Model failed to load. Check the file path.");
        }
    );
}

async function init() {
    if (!canvas || !experienceSection) {
        return;
    }

    try {
        const THREE = await import(LOCAL_THREE_PATH);
        const loaderModule = await import(LOCAL_GLTF_LOADER_PATH);
        const GLTFLoader = loaderModule.GLTFLoader;

        setupScene(THREE);
        loadModel(THREE, GLTFLoader);
        updateAnimation();

        window.addEventListener("resize", onResize);
        window.addEventListener("scroll", onScroll, { passive: true });
        animate();
    } catch (error) {
        console.error("Three.js import error:", error);
        updateStatus("3D viewer needs local Three.js files. See setup notes.");
    }
}

init();
