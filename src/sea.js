// The sea: water surface, shoreline, and the drown-in-the-sea game over. Owned by the sea work.
import * as THREE from 'three';
export function createSea({ scene }) {
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(80000, 80000), new THREE.MeshStandardMaterial({ color: '#1c5876', roughness: 0.12, metalness: 0 }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -0.2; sea.receiveShadow = true;
  scene.add(sea);
  return { update() {}, checkPlayer() {} };
}
