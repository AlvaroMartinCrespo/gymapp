import * as THREE from "three";
import { GLTFLoader } from "../vendor/three/GLTFLoader.js";
import { OrbitControls } from "../vendor/three/OrbitControls.js";
import { MeshoptDecoder } from "../vendor/meshoptimizer/meshopt_decoder.module.js";
import { muscleForName, muscleGroups, muscleAppearance, validMuscles, validHeat } from "./muscles.mjs";

const viewport = document.getElementById("viewport");
const status = document.getElementById("status");
const abort = new AbortController();
const resources = new Set();
const meshes = [];
const notify = (type, extra = {}) => parent.postMessage({ source: "gymapp-anatomy", type, ...extra }, location.origin);
let renderer, controls, scene, camera, observer, intersection;
let state = { primary: [], secondary: [], heat: [], mode: "exercise", camera: "front" };
let frame = 0, tween = null, disposed = false, inViewport = true, sphere;

function fail(message) {
  if (disposed) return;
  cancelAnimationFrame(frame);
  frame = 0;
  status.textContent = message;
  notify("error", { message });
}

function draw(time) {
  frame = 0;
  if (disposed || document.hidden || !inViewport || !renderer || !sphere) return;
  if (tween) {
    const progress = Math.min(1, (time - tween.start) / 650);
    const eased = 1 - (1 - progress) ** 3;
    controls.target.lerpVectors(tween.targetFrom, tween.targetTo, eased);
    camera.position.setFromSpherical(new THREE.Spherical(
      THREE.MathUtils.lerp(tween.from.radius, tween.to.radius, eased),
      THREE.MathUtils.lerp(tween.from.phi, tween.to.phi, eased),
      tween.from.theta + tween.thetaDelta * eased,
    )).add(controls.target);
    if (progress === 1) tween = null;
  }
  controls.update();
  renderer.render(scene, camera);
  if (tween) invalidate();
}

function invalidate() {
  if (!frame && !disposed && !document.hidden && inViewport) frame = requestAnimationFrame(draw);
}

function focus(view = state.camera, smooth = true) {
  if (!sphere) return;
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const distance = sphere.radius / Math.sin(Math.min(halfFov, Math.atan(Math.tan(halfFov) * camera.aspect))) * 1.08;
  const target = new THREE.Vector3();
  const active = meshes.filter((mesh) => state.primary.includes(mesh.userData.muscle));
  if (active.length && state.mode !== "heat") {
    for (const mesh of active) target.add(new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3()));
    target.multiplyScalar(0.2 / active.length);
  }
  const next = target.clone().add(new THREE.Vector3(0, distance * 0.04, view === "back" ? -distance : distance));
  if (smooth && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    const to = new THREE.Spherical().setFromVector3(next.clone().sub(target));
    const thetaDelta = THREE.MathUtils.euclideanModulo(to.theta - from.theta + Math.PI, 2 * Math.PI) - Math.PI;
    tween = { start: performance.now(), from, to, thetaDelta, targetFrom: controls.target.clone(), targetTo: target };
  } else {
    tween = null;
    camera.position.copy(next);
    controls.target.copy(target);
  }
  invalidate();
}

function paint() {
  for (const mesh of meshes) {
    const appearance = muscleAppearance(mesh.userData.muscle, state);
    const material = mesh.material;
    material.color.set(appearance.color);
    material.emissive.set(appearance.active ? appearance.color : "#000000");
    material.emissiveIntensity = appearance.intensity * 0.45;
    // Primary series drive heat intensity; secondary-only work stays wine red.
    if (state.mode === "heat" && appearance.active) material.color.multiplyScalar(0.3 + appearance.intensity * 0.7);
  }
  invalidate();
}

function message(event) {
  if (event.origin !== location.origin || event.source !== parent || event.data?.source !== "gymapp-host") return;
  if (event.data.type === "hello" && sphere) {
    notify("ready", { groups: [...new Set(meshes.map((mesh) => mesh.userData.muscle))] });
  } else if (event.data.type === "state") {
    const value = event.data.state ?? {};
    const next = {
      primary: validMuscles(value.primary), secondary: validMuscles(value.secondary), heat: validHeat(value.heat),
      mode: value.mode === "heat" ? "heat" : "exercise", camera: value.camera === "back" ? "back" : "front",
    };
    const changed = JSON.stringify([next.primary, next.camera, next.mode]) !== JSON.stringify([state.primary, state.camera, state.mode]);
    state = next;
    paint();
    if (changed) focus();
  } else if (event.data.type === "view") {
    focus(event.data.view === "back" ? "back" : "front");
  } else if (event.data.type === "rotate") {
    rotate(event.data.direction === "left" ? -1 : 1);
  }
}

function rotate(direction) {
  if (!controls || !sphere) return;
  tween = null;
  const offset = camera.position.clone().sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), direction * Math.PI / 8);
  camera.position.copy(controls.target).add(offset);
  invalidate();
}

function dispose() {
  disposed = true;
  abort.abort();
  cancelAnimationFrame(frame);
  observer?.disconnect();
  intersection?.disconnect();
  controls?.dispose();
  window.removeEventListener("message", message);
  for (const resource of resources) resource.dispose();
  renderer?.dispose();
}

async function initialize() {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.setClearColor("#09090b");
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      fail("Se ha perdido el contexto 3D. Pulsa Reintentar para recuperarlo.");
    });
    viewport.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = false;
    controls.minPolarAngle = Math.PI * 0.15;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.addEventListener("change", invalidate);
    controls.addEventListener("start", () => { tween = null; });
    scene.add(new THREE.HemisphereLight("#ffffff", "#333344", 2.5));
    const light = new THREE.DirectionalLight("#ffffff", 3);
    light.position.set(3, 4, 5);
    scene.add(light);
    const rim = new THREE.DirectionalLight("#b9b9d0", 2);
    rim.position.set(-3, 1, -4);
    scene.add(rim);

    const response = await fetch("/models/human_muscles.glb", { signal: abort.signal });
    if (!response.ok) throw new Error("model fetch failed");
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.parseAsync(await response.arrayBuffer(), "/models/");
    gltf.scene.traverse((object) => {
      if (!object.isMesh) return;
      resources.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
        resources.add(material);
      }
      const group = muscleForName(object.userData.name || object.name);
      object.userData.muscle = group;
      object.material = new THREE.MeshStandardMaterial({ color: group ? "#27272a" : "#19191c", roughness: 0.8, metalness: 0.15 });
      resources.add(object.material);
      if (group) meshes.push(object);
    });
    if (disposed) { for (const resource of resources) resource.dispose(); return; }
    const model = new THREE.Group();
    model.add(gltf.scene);
    scene.add(model);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    if (!Number.isFinite(size.y) || size.y <= 0) throw new Error("empty model");
    model.scale.setScalar(2 / size.y);
    model.updateMatrixWorld(true);
    model.position.sub(new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3()));
    model.updateMatrixWorld(true);
    sphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
    if (!meshes.length) throw new Error("unmapped model");
    const resize = () => {
      const { width, height } = viewport.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      focus(state.camera, false);
    };
    observer = new ResizeObserver(resize);
    observer.observe(viewport);
    intersection = new IntersectionObserver(([entry]) => { inViewport = entry.isIntersecting; invalidate(); });
    intersection.observe(viewport);
    document.addEventListener("visibilitychange", invalidate, { signal: abort.signal });
    viewport.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "Home" || event.key === "End") focus(event.key === "Home" ? "front" : "back");
      else rotate(event.key === "ArrowLeft" ? -1 : 1);
    }, { signal: abort.signal });
    const raycaster = new THREE.Raycaster();
    let pointerStart;
    viewport.addEventListener("pointerdown", (event) => { pointerStart = [event.clientX, event.clientY]; }, { signal: abort.signal });
    viewport.addEventListener("pointerup", (event) => {
      if (!pointerStart || Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) > 6) return;
      const rect = viewport.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
      const group = raycaster.intersectObjects(meshes, false)[0]?.object.userData.muscle;
      if (group) notify("selection", { group, label: muscleGroups[group] });
    }, { signal: abort.signal });
    paint();
    resize();
    status.textContent = "";
    notify("ready", { groups: [...new Set(meshes.map((mesh) => mesh.userData.muscle))] });
  } catch (error) {
    if (error?.name !== "AbortError") fail("No se pudo cargar la anatomía 3D. Comprueba WebGL y vuelve a intentarlo.");
  }
}

window.addEventListener("message", message);
window.addEventListener("pagehide", dispose, { once: true });
initialize();