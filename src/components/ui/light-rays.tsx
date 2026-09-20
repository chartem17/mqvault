"use client";

import { useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";

export default function LightRays() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;

    const renderer = new Renderer({
      alpha: true,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    });
    const gl = renderer.gl;
    gl.canvas.style.cssText = "width:100%;height:100%;display:block";
    element.appendChild(gl.canvas);

    const program = new Program(gl, {
      vertex: `
        attribute vec2 position;
        void main() {
          gl_Position = vec4(position, 0.0, 1.0);
        }
      `,
      fragment: `
        precision highp float;

        uniform vec2 uResolution;
        uniform vec2 uMouse;
        uniform float uTime;

        float beam(vec2 uv, vec2 direction, float seed) {
          vec2 p = uv - vec2(0.5, -0.34);
          float angle = atan(p.x, p.y) - atan(direction.x, direction.y);

          float width = 0.52 + 0.002 * sin(seed + uTime * 0.11);
          float edge = exp(-pow(angle / width, 2.0));
          float movement = 0.56 + 0.54 * sin(angle * 29.0 + seed + uTime * 0.18);
          float fade = smoothstep(1.88, 0.02, length(p));

          return edge * movement * fade;
        }

        void main() {
          vec2 uv = gl_FragCoord.xy / uResolution.xy;
          uv.y = 1.0 - uv.y;

          float driftX = sin(uTime * 0.18) * 0.12;
          float driftY = cos(uTime * 0.13) * 0.035;
          vec2 idleDirection = normalize(vec2(driftX, 1.0 + driftY));

          vec2 mouseDirection = normalize(uMouse - vec2(0.5, -0.34));
          vec2 direction = normalize(mix(idleDirection, mouseDirection, 0.03));

          float light = 0.3;
          light += beam(uv, direction, 0.0);
          light += beam(uv, normalize(direction + vec2(0.18, 0.0)), 2.2);
          light += beam(uv, normalize(direction - vec2(0.19, 0.0)), 4.6);
          light += beam(uv, normalize(direction + vec2(0.36, 0.0)), 1.2);
          light += beam(uv, normalize(direction - vec2(0.35, 0.0)), 3.5);

          light *= 0.17;
          gl_FragColor = vec4(vec3(1.0) * light, light * 0.9);
        }
      `,
      uniforms: {
        uResolution: { value: [1, 1] },
        uMouse: { value: [0.5, 0.55] },
        uTime: { value: 0 },
      },
    });

    const mesh = new Mesh(gl, {
      geometry: new Triangle(gl),
      program,
    });

    let animationFrame = 0;

    const resize = () => {
      const rect = element.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height);
      program.uniforms.uResolution.value = [
        rect.width * renderer.dpr,
        rect.height * renderer.dpr,
      ];
    };

    const move = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      program.uniforms.uMouse.value = [
        (event.clientX - rect.left) / rect.width,
        (event.clientY - rect.top) / rect.height,
      ];
    };

    const render = (time: number) => {
      program.uniforms.uTime.value = time * 0.001;
      renderer.render({ scene: mesh });
      animationFrame = requestAnimationFrame(render);
    };

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", move, { passive: true });
    resize();
    animationFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      gl.canvas.remove();
    };
  }, []);

  return (
    <div
      ref={host}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#090b10]"
    />
  );
}
