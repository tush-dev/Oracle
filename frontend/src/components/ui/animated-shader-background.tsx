import { useEffect, useRef } from "react"
import * as THREE from "three"

const AnoAI = () => {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    const getSize = () => ({
      width: container.clientWidth || window.innerWidth,
      height: container.clientHeight || window.innerHeight,
    })
    const { width, height } = getSize()
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.domElement.className = "absolute inset-0 h-full w-full"
    container.appendChild(renderer.domElement)

    const material = new THREE.ShaderMaterial({
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector2(width, height) },
      },
      vertexShader: `
        void main() {
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float iTime;
        uniform vec2 iResolution;

        #define NUM_OCTAVES 3

        float rand(vec2 n) {
          return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 ip = floor(p);
          vec2 u = fract(p);
          u = u*u*(3.0-2.0*u);

          float res = mix(
            mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x),
            mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x), u.y);
          return res * res;
        }

        float fbm(vec2 x) {
          float v = 0.0;
          float a = 0.3;
          vec2 shift = vec2(100);
          mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
          for (int i = 0; i < NUM_OCTAVES; ++i) {
            v += a * noise(x);
            x = rot * x * 2.0 + shift;
            a *= 0.4;
          }
          return v;
        }

        vec4 aurora(vec2 p, float seed, float strength) {
          vec2 v;
          vec4 o = vec4(0.0);

          float f = 2.0 + fbm(p + vec2(iTime * 5.0 + seed, 0.0)) * 0.5;

          for (float i = 0.0; i < 35.0; i++) {
            v = p + cos(i * i + seed + (iTime + p.x * 0.08) * 0.025 + i * vec2(13.0, 11.0)) * 3.5 + vec2(sin(iTime * 3.0 + i + seed) * 0.003, cos(iTime * 3.5 - i - seed) * 0.003);
            float tailNoise = fbm(v + vec2(iTime * 0.5 + seed, i)) * 0.3 * (1.0 - (i / 35.0));
            vec4 auroraColors = vec4(
              0.1 + 0.3 * sin(i * 0.2 + iTime * 0.4 + seed),
              0.3 + 0.5 * cos(i * 0.3 + iTime * 0.5 + seed),
              0.7 + 0.3 * sin(i * 0.4 + iTime * 0.3 + seed),
              1.0
            );
            vec4 currentContribution = auroraColors * exp(sin(i * i + iTime * 0.8 + seed)) / length(max(v, vec2(v.x * f * 0.015, v.y * 1.5)));
            float thinnessFactor = smoothstep(0.0, 1.0, i / 35.0) * 0.6;
            o += currentContribution * (1.0 + tailNoise * 0.8) * thinnessFactor;
          }

          return tanh(pow(o / 100.0, vec4(1.6))) * strength;
        }

        void main() {
          vec2 shake = vec2(sin(iTime * 1.2) * 0.005, cos(iTime * 2.1) * 0.005);
          vec2 uv = ((gl_FragCoord.xy + shake * iResolution.xy) - iResolution.xy * 0.5) / iResolution.y;
          vec2 p = uv * mat2(3.6, -2.4, 2.4, 3.6);
          vec4 o = vec4(0.0);

          o += aurora(p + vec2(-1.15, 0.15), 0.0, 1.35);
          o += aurora(vec2(-p.x, p.y) + vec2(-1.0, -0.3), 11.0, 1.05);
          o += aurora((p * 0.76) + vec2(1.1, -0.75), 23.0, 0.72);

          gl_FragColor = o * 1.45;
        }
      `,
    })

    const geometry = new THREE.PlaneGeometry(2, 2)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    let frameId = 0
    const animate = () => {
      material.uniforms.iTime.value += 0.016
      renderer.render(scene, camera)
      frameId = requestAnimationFrame(animate)
    }
    animate()

    const handleResize = () => {
      const { width, height } = getSize()
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(width, height)
      material.uniforms.iResolution.value.set(width, height)
    }
    window.addEventListener("resize", handleResize)
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(container)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener("resize", handleResize)
      resizeObserver.disconnect()
      renderer.domElement.remove()
      geometry.dispose()
      material.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <div ref={containerRef} className="absolute inset-0 h-full w-full overflow-hidden">
      <div className="relative z-10 divider" />
    </div>
  )
}

export default AnoAI
