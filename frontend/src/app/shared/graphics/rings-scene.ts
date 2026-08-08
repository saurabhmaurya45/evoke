import {
  AdditiveBlending,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  CanvasTexture,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  Scene,
  TorusGeometry,
  WebGLRenderer,
} from 'three';

/**
 * Framework-agnostic Three.js scene: two interlocking gold wedding rings
 * drifting in a field of golden particles. Designed as a full-page backdrop —
 * a normalised (0..1) scroll progress rotates and gently floats the rings so
 * the composition evolves as the visitor moves down the page.
 *
 * Owns every GPU resource and disposes it explicitly. No framework concerns
 * live here — the Angular wrapper drives its lifecycle and feeds parallax.
 */
export class RingsScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly rings = new Group();
  private readonly particles: Points[];
  private goldMaterial!: MeshStandardMaterial;
  private sandMaterial!: MeshStandardMaterial;
  private particleMaterials: PointsMaterial[] = [];

  private targetRotX = 0;
  private targetRotY = 0;
  private currentRotX = 0;
  private currentRotY = 0;
  private scrollProgress = 0;

  private readonly disposables: { dispose(): void }[] = [];

  constructor(canvas: HTMLCanvasElement, width: number, height: number, pixelRatio: number) {
    this.renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(pixelRatio, 2));
    this.renderer.setSize(width, height, false);
    this.renderer.setClearColor(0x000000, 0);

    this.camera = new PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 0, 7.5);

    this.buildLights();
    this.buildRings();
    this.particles = this.buildParticles();

    this.scene.add(this.rings);
    this.particles.forEach((particles) => this.scene.add(particles));
  }

  private buildLights(): void {
    this.scene.add(new AmbientLight(0xffffff, 0.55));

    const warm = new DirectionalLight(0xffe0a0, 2.4);
    warm.position.set(4, 5, 6);
    this.scene.add(warm);

    const cool = new DirectionalLight(0x8899ff, 0.7);
    cool.position.set(-6, -2, 3);
    this.scene.add(cool);

    const glow = new PointLight(0xffce6b, 1.6, 22);
    glow.position.set(0, 0, 3);
    this.scene.add(glow);
  }

  private buildRings(): void {
    // Keep the backdrop decorative: the rings should support foreground content,
    // not compete with it on wide screens.
    const geometry = new TorusGeometry(1.08, 0.1, 48, 160);
    this.disposables.push(geometry);

    const goldMat = new MeshStandardMaterial({
      color: new Color(0xc9a227),
      metalness: 0.95,
      roughness: 0.28,
      emissive: new Color(0x3a2a08),
      emissiveIntensity: 0.22,
      transparent: true,
      opacity: 0.62,
    });
    const sandMat = new MeshStandardMaterial({
      color: new Color(0xe8c88a),
      metalness: 0.92,
      roughness: 0.32,
      emissive: new Color(0x3a2e12),
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.52,
    });
    this.disposables.push(goldMat, sandMat);
    this.goldMaterial = goldMat;
    this.sandMaterial = sandMat;

    const ringA = new Mesh(geometry, goldMat);
    ringA.rotation.set(0.5, 0.2, 0);
    ringA.position.x = -0.55;

    const ringB = new Mesh(geometry, sandMat);
    ringB.rotation.set(1.15, -0.35, 0.4);
    ringB.position.x = 0.7;
    ringB.position.y = -0.15;

    this.rings.add(ringA, ringB);
  }

  private buildParticles(): Points[] {
    return (['circle', 'diamond', 'cross'] as const).map((shape, layer) => {
      const count = layer === 0 ? 500 : 200;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const radius = 3 + Math.random() * 7;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = radius * Math.cos(phi) - 2;
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(positions, 3));
      const texture = this.createParticleTexture(shape);
      const material = new PointsMaterial({
        color: new Color(0xe8c88a),
        size: layer === 0 ? 0.06 : 0.09,
        map: texture,
        alphaTest: 0.05,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.85,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      this.disposables.push(geometry, material, texture);
      this.particleMaterials.push(material);
      return new Points(geometry, material);
    });
  }

  private createParticleTexture(shape: 'circle' | 'diamond' | 'cross'): CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d');
    if (!context) return new CanvasTexture(canvas);
    context.fillStyle = '#ffffff';
    context.shadowColor = '#ffffff';
    context.shadowBlur = 5;
    context.beginPath();
    if (shape === 'circle') {
      context.arc(16, 16, 6, 0, Math.PI * 2);
    } else if (shape === 'diamond') {
      context.moveTo(16, 5); context.lineTo(27, 16); context.lineTo(16, 27); context.lineTo(5, 16); context.closePath();
    } else {
      context.rect(13, 4, 6, 24); context.rect(4, 13, 24, 6);
    }
    context.fill();
    return new CanvasTexture(canvas);
  }

  setTheme(theme: 'dark' | 'light'): void {
    if (theme === 'light') {
      this.goldMaterial.color.set(0x8b641d);
      this.sandMaterial.color.set(0xb18432);
      this.particleMaterials.forEach((material) => material.color.set(0x9a6a18));
      this.goldMaterial.opacity = 0.72;
      this.sandMaterial.opacity = 0.62;
      this.particleMaterials.forEach((material) => { material.opacity = 0.98; material.size = 0.08; });
    } else {
      this.goldMaterial.color.set(0xc9a227);
      this.sandMaterial.color.set(0xe8c88a);
      this.particleMaterials.forEach((material) => material.color.set(0xe8c88a));
      this.goldMaterial.opacity = 0.62;
      this.sandMaterial.opacity = 0.52;
      this.particleMaterials.forEach((material) => { material.opacity = 0.85; material.size = 0.06; });
    }
  }

  /**
   * @param px pointer X offset (-0.5..0.5)
   * @param py pointer Y offset (-0.5..0.5)
   * @param scrollProgress page scroll fraction (0 top .. 1 bottom)
   */
  setParallax(px: number, py: number, scrollProgress: number): void {
    this.targetRotY = px * 0.6;
    this.targetRotX = py * 0.5;
    this.scrollProgress = scrollProgress;
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  render(elapsed: number, delta: number): void {
    this.currentRotX += (this.targetRotX - this.currentRotX) * Math.min(delta * 4, 1);
    this.currentRotY += (this.targetRotY - this.currentRotY) * Math.min(delta * 4, 1);

    const p = this.scrollProgress;
    // Idle spin + pointer tilt + a full sweep across the page's scroll range.
    this.rings.rotation.y = elapsed * 0.2 + p * Math.PI * 2.2 + this.currentRotY;
    this.rings.rotation.x = Math.sin(elapsed * 0.4) * 0.12 + p * 0.8 + this.currentRotX;
    // Gentle vertical float that keeps the rings on-screen the whole way down.
    this.rings.position.y = Math.sin(p * Math.PI) * 0.5;

    this.particles.forEach((particles, index) => {
      particles.rotation.y = elapsed * (0.035 + index * 0.008) + p * (0.6 + index * 0.08) + this.currentRotY * 0.3;
      particles.rotation.x = this.currentRotX * 0.2;
    });

    this.camera.position.x = this.currentRotY * 0.5;
    this.camera.position.y = -this.currentRotX * 0.4;
    this.camera.lookAt(0, this.rings.position.y * 0.4, 0);

    this.renderer.render(this.scene, this.camera);
  }

  /** Single static frame (used under prefers-reduced-motion). */
  renderStatic(): void {
    this.rings.rotation.set(0.15, 0.4, 0);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
    this.renderer.dispose();
  }
}
