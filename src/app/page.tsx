"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { TextPlugin } from "gsap/TextPlugin"
import Image from "next/image"

gsap.registerPlugin(ScrollTrigger, TextPlugin)

// ─── GLSL SHADERS ─────────────────────────────────────────────────────────────
const noiseGLSL = /* glsl */`
  vec3 mod289v3(vec3 x){ return x - floor(x*(1./289.))*289.; }
  vec4 mod289v4(vec4 x){ return x - floor(x*(1./289.))*289.; }
  vec4 permute4(vec4 x){ return mod289v4(((x*34.)+1.)*x); }
  vec4 taylorInvSqrt4(vec4 r){ return 1.7928429-.8537347*r; }
  float snoise(vec3 v){
    const vec2 C=vec2(1./6.,1./3.);
    const vec4 D=vec4(0.,.5,1.,2.);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod289v3(i);
    vec4 p=permute4(permute4(permute4(
      i.z+vec4(0.,i1.z,i2.z,1.))
      +i.y+vec4(0.,i1.y,i2.y,1.))
      +i.x+vec4(0.,i1.x,i2.x,1.));
    float n_=.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.+1.;
    vec4 s1=floor(b1)*2.+1.;
    vec4 sh=-step(h,vec4(0.));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt4(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
    vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
    m=m*m;
    return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
  float fbm(vec3 p,int oct){
    float v=0.,a=.5,f=1.;
    for(int i=0;i<8;i++){
      if(i>=oct)break;
      v+=a*snoise(p*f);
      f*=2.1;a*=.48;
    }
    return v;
  }
`

// Sol
const sunVert = /* glsl */`
  varying vec3 vNormal; varying vec3 vPosition;
  void main(){
    vNormal=normalize(normalMatrix*normal);
    vPosition=position;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
  }
`
const sunFrag = /* glsl */`
  ${noiseGLSL}
  uniform float uTime;
  varying vec3 vNormal; varying vec3 vPosition;
  void main(){
    vec3 p=normalize(vPosition);
    float gran=fbm(p*6.+vec3(uTime*.03),6);
    float gran2=fbm(p*14.+vec3(uTime*.05,0.,0.),4);
    float cells=smoothstep(-.1,.4,gran)*smoothstep(-.1,.5,gran2);
    float spot1=smoothstep(.18,.0,length(p.xy-vec2(.3,.4)));
    float spot2=smoothstep(.12,.0,length(p.xy-vec2(-.2,-.3)));
    float spots=max(spot1,spot2);
    float rim=1.-max(0.,dot(vNormal,vec3(0.,0.,1.)));
    float flare=fbm(p*3.+vec3(0.,uTime*.08,uTime*.04),5);
    float prominence=pow(rim,2.5)*(0.5+0.5*flare);
    vec3 cCore=vec3(1.,.98,.72);
    vec3 cMid=vec3(1.,.72,.08);
    vec3 cEdge=vec3(.95,.30,.02);
    vec3 cSpot=vec3(.20,.06,.00);
    float t=pow(rim,1.4);
    vec3 col=mix(cCore,cMid,t);
    col=mix(col,cEdge,pow(t,2.));
    col=mix(col,col*(.7+.3*cells),.5);
    col=mix(col,cSpot,spots*.85);
    col+=vec3(1.,.4,.05)*prominence*.6;
    col*=.97+.03*sin(uTime*1.2);
    gl_FragColor=vec4(col,1.);
  }
`

// Corona
const coronaVert = /* glsl */`
  varying vec3 vNormal; varying vec3 vPosition;
  void main(){
    vNormal=normalize(normalMatrix*normal);
    vPosition=position;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
  }
`
const coronaFrag = /* glsl */`
  ${noiseGLSL}
  uniform float uTime; uniform float uOpacity;
  varying vec3 vNormal; varying vec3 vPosition;
  void main(){
    vec3 p=normalize(vPosition);
    float rim=1.-max(0.,dot(vNormal,vec3(0.,0.,1.)));
    float n=fbm(p*2.5+vec3(uTime*.05,0.,uTime*.03),5);
    float n2=fbm(p*5.-vec3(0.,uTime*.04,0.),4);
    float corona=pow(rim,1.2)*(0.5+0.5*n)*(0.6+0.4*n2);
    corona=smoothstep(0.,1.,corona);
    float rays=fbm(p*1.8+vec3(uTime*.02),3);
    corona+=pow(rim,3.)*rays*.4;
    vec3 col=mix(vec3(1.,.5,0.),vec3(1.,.9,.3),pow(rim,.5));
    col=mix(col,vec3(1.,.15,0.),pow(1.-rim,3.));
    gl_FragColor=vec4(col*1.4,corona*uOpacity*.85);
  }
`

// Terra
const earthVert = /* glsl */`
  varying vec3 vNormal; varying vec3 vPosition;
  void main(){
    vNormal=normalize(normalMatrix*normal);
    vPosition=position;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
  }
`
const earthFrag = /* glsl */`
  ${noiseGLSL}
  uniform float uTime; uniform vec3 uLightDir;
  varying vec3 vNormal; varying vec3 vPosition;
  float continentMap(vec3 p){
    float base=fbm(p*1.8,6);
    float detail=fbm(p*4.5+vec3(3.1,1.7,2.3),4);
    return smoothstep(.05,.25,base+detail*.25);
  }
  float cloudMap(vec3 p){
    float c1=fbm(p*3.5+vec3(uTime*.012,0.,uTime*.008),5);
    float c2=fbm(p*7.+vec3(0.,uTime*.015,uTime*.010),3);
    return smoothstep(.1,.55,c1*.7+c2*.3);
  }
  void main(){
    vec3 p=normalize(vPosition);
    float diff=max(0.,dot(vNormal,uLightDir));
    float nightSide=1.-smoothstep(-.25,.25,dot(vNormal,uLightDir));
    float land=continentMap(p);
    float mountains=fbm(p*12.+vec3(2.,5.,1.),5)*land;
    float mountainMask=smoothstep(.3,.8,mountains);
    float lat=abs(p.y);
    float desert=smoothstep(.15,.35,lat)*(1.-smoothstep(.45,.6,lat));
    float polar=smoothstep(.62,.82,lat);
    vec3 biomeLand=mix(vec3(.10,.28,.08),vec3(.18,.42,.10),fbm(p*6.,3)*.5+.5);
    biomeLand=mix(biomeLand,vec3(.62,.48,.22),desert*smoothstep(.3,.7,fbm(p*4.,3)));
    biomeLand=mix(biomeLand,vec3(.42,.36,.28),mountainMask);
    biomeLand=mix(biomeLand,vec3(.90,.93,.98),mountainMask*smoothstep(.6,.9,mountains));
    biomeLand=mix(biomeLand,vec3(.82,.90,.98),polar);
    float oceanDepth=smoothstep(.0,.8,fbm(p*2.5,4)*.5+.5);
    vec3 biomeOcean=mix(vec3(.01,.06,.22),vec3(.02,.18,.42),oceanDepth);
    vec3 surface=mix(biomeOcean,biomeLand,land);
    surface=mix(surface,vec3(.82,.90,.98),polar*1.2);
    float specularMask=(1.-land)*(1.-polar);
    float spec=pow(max(0.,dot(vNormal,normalize(uLightDir+vec3(0.,0.,1.)))),60.)*specularMask;
    vec3 lit=surface*(.04+diff*.96)+vec3(1.,.95,.7)*spec*.8;
    float cityNoise=fbm(p*18.+vec3(5.,7.,3.),4);
    float cities=land*smoothstep(.55,.9,cityNoise)*nightSide;
    lit+=vec3(1.,.85,.4)*cities*.35;
    float terminator=exp(-pow(dot(vNormal,uLightDir)*6.,2.));
    lit+=vec3(.9,.35,.05)*terminator*.25;
    float clouds=cloudMap(p);
    float cloudLit=max(0.08,diff)*(1.-nightSide*.85);
    lit=mix(lit,vec3(.88,.92,.98)*cloudLit,clouds*.88);
    gl_FragColor=vec4(lit,1.);
  }
`

// Atmosfera
const atmosVert = /* glsl */`
  varying vec3 vNormal;
  void main(){
    vNormal=normalize(normalMatrix*normal);
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
  }
`
const atmosFrag = /* glsl */`
  uniform float uOpacity; uniform vec3 uLightDir;
  varying vec3 vNormal;
  void main(){
    float rim=1.-max(0.,dot(vNormal,vec3(0.,0.,1.)));
    float sun=max(0.,dot(vNormal,uLightDir));
    float dusk=pow(1.-abs(sun-.1)/1.1,4.);
    vec3 col=mix(vec3(.15,.45,1.),vec3(.95,.40,.05),dusk*.7);
    float alpha=pow(rim,1.8)*uOpacity*(.3+.7*sun);
    alpha+=dusk*.15;
    gl_FragColor=vec4(col,clamp(alpha,0.,1.));
  }
`

// Shader genérico para planetas rochosos/gasosos
const planetVert = /* glsl */`
  varying vec3 vNormal; varying vec3 vPosition;
  void main(){
    vNormal=normalize(normalMatrix*normal);
    vPosition=position;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
  }
`
const makePlanetFrag = (r1: string, r2: string, g1: string, g2: string, b1: string, b2: string, bands = false) => /* glsl */`
  ${noiseGLSL}
  uniform float uTime; uniform vec3 uLightDir;
  varying vec3 vNormal; varying vec3 vPosition;
  void main(){
    vec3 p=normalize(vPosition);
    float diff=max(0.04,dot(vNormal,uLightDir));
    float n=fbm(p*3.+vec3(uTime*.01),4);
    float n2=fbm(p*7.+vec3(1.,uTime*.008,0.),3);
    ${bands ? "float band=sin(p.y*12.+n*2.)*.5+.5;" : "float band=n*.5+.5;"}
    vec3 c1=vec3(${r1},${g1},${b1});
    vec3 c2=vec3(${r2},${g2},${b2});
    vec3 col=mix(c1,c2,band+n2*.3);
    col*=diff;
    gl_FragColor=vec4(col,1.);
  }
`

// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const nameRef      = useRef<HTMLHeadingElement>(null)
  const typedRef     = useRef<HTMLSpanElement>(null)
  const scrollRef    = useRef<HTMLDivElement>(null)
  const photoRef     = useRef<HTMLDivElement>(null)
  const aboutTextRef = useRef<HTMLDivElement>(null)
  const skillsRef    = useRef<HTMLDivElement>(null)
  const contactRef   = useRef<HTMLDivElement>(null)
  const lineRef      = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.01, 5000)
    camera.position.set(0, 120, 30)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x00000a, 1)

    // ── GALÁXIA (fundo, escala grande) ──────────────────────────────────────
    const ARM = 4, STARS = 160000
    const gPos = new Float32Array(STARS * 3)
    const gCol = new Float32Array(STARS * 3)
    for (let i = 0; i < STARS; i++) {
      const i3 = i * 3
      const rad = 3 + Math.pow(Math.random(), 0.6) * 280
      const arm = (i % ARM) / ARM * Math.PI * 2
      const ang = arm + rad * 0.018 + (Math.random() - 0.5) * (0.5 + rad * 0.005)
      const sc  = Math.pow(Math.random(), 2.5) * rad * 0.1
      const sa  = Math.random() * Math.PI * 2
      gPos[i3]   = Math.cos(ang) * rad + Math.cos(sa) * sc
      gPos[i3+1] = (Math.random() - 0.5) * Math.exp(-rad * 0.008) * 20
      gPos[i3+2] = Math.sin(ang) * rad + Math.sin(sa) * sc
      const t = rad / 280
      let r, g, b
      if      (t < 0.08) { r=1.0; g=0.85; b=0.5 }
      else if (t < 0.25) { r=1.0; g=0.93; b=0.75 }
      else if (t < 0.55) {
        const tp = Math.random()
        if      (tp < 0.45) { r=0.6+Math.random()*0.4; g=0.7+Math.random()*0.3; b=1.0 }
        else if (tp < 0.75) { r=1.0; g=0.95; b=0.9 }
        else                { r=1.0; g=0.8; b=0.4+Math.random()*0.3 }
      } else { r=0.5+Math.random()*0.3; g=0.6+Math.random()*0.3; b=1.0 }
      if (Math.random() < 0.006) { r=1;g=1;b=1 }
      gCol[i3]=r; gCol[i3+1]=g; gCol[i3+2]=b
    }
    const gGeo = new THREE.BufferGeometry()
    gGeo.setAttribute("position", new THREE.BufferAttribute(gPos, 3))
    gGeo.setAttribute("color",    new THREE.BufferAttribute(gCol, 3))
    const galaxy = new THREE.Points(gGeo, new THREE.PointsMaterial({
      size: 0.12, vertexColors: true, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }))
    scene.add(galaxy)

    // Núcleo galáctico
    const cGeo = new THREE.BufferGeometry()
    const cPos = new Float32Array(10000 * 3), cCol2 = new Float32Array(10000 * 3)
    for (let i = 0; i < 10000; i++) {
      const r = Math.pow(Math.random(), 1.5) * 18
      const th = Math.random() * Math.PI * 2
      cPos[i*3]   = Math.cos(th) * r; cPos[i*3+1] = (Math.random()-.5)*r*.15; cPos[i*3+2] = Math.sin(th) * r
      cCol2[i*3]=1; cCol2[i*3+1]=0.75+Math.random()*.2; cCol2[i*3+2]=0.3+Math.random()*.3
    }
    cGeo.setAttribute("position", new THREE.BufferAttribute(cPos, 3))
    cGeo.setAttribute("color",    new THREE.BufferAttribute(cCol2, 3))
    scene.add(new THREE.Points(cGeo, new THREE.PointsMaterial({
      size: 0.18, vertexColors: true, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })))

    // Estrelas fundo (campo estelar profundo)
    const bgGeo = new THREE.BufferGeometry()
    const bgPos = new Float32Array(8000*3), bgCol = new Float32Array(8000*3)
    for (let i = 0; i < 8000; i++) {
      bgPos[i*3]=(Math.random()-.5)*2000; bgPos[i*3+1]=(Math.random()-.5)*800; bgPos[i*3+2]=(Math.random()-.5)*2000
      const t=Math.random(); bgCol[i*3]=.5+t*.5; bgCol[i*3+1]=.5+t*.5; bgCol[i*3+2]=.7+t*.3
    }
    bgGeo.setAttribute("position", new THREE.BufferAttribute(bgPos, 3))
    bgGeo.setAttribute("color",    new THREE.BufferAttribute(bgCol, 3))
    scene.add(new THREE.Points(bgGeo, new THREE.PointsMaterial({
      size: 0.3, vertexColors: true, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })))

    // ── SISTEMA SOLAR ────────────────────────────────────────────────────────
    // Sistema solar centrado em (0, 0, 0) — escala artística
    const SUN_R = 3.5

    // SOL
    const sunMat = new THREE.ShaderMaterial({
      vertexShader: sunVert, fragmentShader: sunFrag,
      uniforms: { uTime: { value: 0 } },
    })
    const sun = new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 96, 96), sunMat)
    scene.add(sun)

    // Corona interna
    const cInMat = new THREE.ShaderMaterial({
      vertexShader: coronaVert, fragmentShader: coronaFrag,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0.8 } },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
    })
    const coronaIn = new THREE.Mesh(new THREE.SphereGeometry(SUN_R * 1.7, 64, 64), cInMat)
    scene.add(coronaIn)

    // Corona externa
    const cOutMat = new THREE.ShaderMaterial({
      vertexShader: coronaVert, fragmentShader: coronaFrag,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0.3 } },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
    })
    const coronaOut = new THREE.Mesh(new THREE.SphereGeometry(SUN_R * 3.5, 64, 64), cOutMat)
    scene.add(coronaOut)

    const sunLight = new THREE.PointLight(0xfff5cc, 4, 400)
    scene.add(sunLight)
    scene.add(new THREE.AmbientLight(0x111122, 0.3))

    // Definição dos planetas: [nome, raioOrbita, raioEsfera, velocidadeOrbital, inclinação, shaderFrag, cor anel?]
    interface PlanetDef {
      name: string; orbit: number; size: number; speed: number;
      tilt: number; frag: string; hasRing?: boolean; ringColor?: number
    }

    const planetDefs: PlanetDef[] = [
      { name: "mercury", orbit: 7,    size: 0.18, speed: 4.74,  tilt: 0.03,
        frag: makePlanetFrag("0.6","0.55","0.5","0.45","0.45","0.4") },
      { name: "venus",   orbit: 11,   size: 0.44, speed: 3.5,   tilt: 3.09,
        frag: makePlanetFrag("0.85","0.7","0.6","0.5","0.3","0.2") },
      { name: "earth",   orbit: 16,   size: 0.46, speed: 2.98,  tilt: 0.41,  frag: "" },
      { name: "mars",    orbit: 22,   size: 0.26, speed: 2.41,  tilt: 0.44,
        frag: makePlanetFrag("0.75","0.55","0.28","0.2","0.1","0.07") },
      { name: "jupiter", orbit: 38,   size: 1.4,  speed: 1.31,  tilt: 0.05,
        frag: makePlanetFrag("0.72","0.6","0.52","0.44","0.38","0.3", true) },
      { name: "saturn",  orbit: 56,   size: 1.15, speed: 0.97,  tilt: 0.47,
        frag: makePlanetFrag("0.78","0.65","0.62","0.52","0.4","0.32", true), hasRing: true, ringColor: 0xc8a96e },
      { name: "uranus",  orbit: 72,   size: 0.75, speed: 0.68,  tilt: 1.71,
        frag: makePlanetFrag("0.4","0.5","0.75","0.82","0.9","0.95", true) },
      { name: "neptune", orbit: 88,   size: 0.7,  speed: 0.54,  tilt: 0.49,
        frag: makePlanetFrag("0.15","0.2","0.3","0.45","0.85","0.95", true) },
    ]

    // Pivôs de órbita e meshes dos planetas
    const planetPivots: THREE.Object3D[] = []
    const planetMeshes: THREE.Mesh[] = []
    const planetAngles: number[] = planetDefs.map(() => Math.random() * Math.PI * 2)

    // Terra especial
    let earthMesh: THREE.Mesh, earthMat_: THREE.ShaderMaterial
    let atmosMesh: THREE.Mesh, atmosMat_: THREE.ShaderMaterial
    const earthDef = planetDefs[2]

    planetDefs.forEach((def, idx) => {
      // Anel orbital (elipse no chão)
      const orbitGeo = new THREE.BufferGeometry()
      const orbitPts = 256
      const orbitPos = new Float32Array(orbitPts * 3)
      for (let i = 0; i < orbitPts; i++) {
        const a = (i / orbitPts) * Math.PI * 2
        orbitPos[i*3]   = Math.cos(a) * def.orbit
        orbitPos[i*3+1] = 0
        orbitPos[i*3+2] = Math.sin(a) * def.orbit
      }
      orbitGeo.setAttribute("position", new THREE.BufferAttribute(orbitPos, 3))
      scene.add(new THREE.LineLoop(orbitGeo, new THREE.LineBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.06,
      })))

      // Pivô
      const pivot = new THREE.Object3D()
      scene.add(pivot)
      planetPivots.push(pivot)

      // Mesh do planeta
      let mesh: THREE.Mesh
      if (def.name === "earth") {
        earthMat_ = new THREE.ShaderMaterial({
          vertexShader: earthVert, fragmentShader: earthFrag,
          uniforms: {
            uTime:     { value: 0 },
            uLightDir: { value: new THREE.Vector3(1, 0, 0) },
          },
        })
        mesh = new THREE.Mesh(new THREE.SphereGeometry(def.size, 128, 128), earthMat_)
        earthMesh = mesh

        // Atmosfera
        atmosMat_ = new THREE.ShaderMaterial({
          vertexShader: atmosVert, fragmentShader: atmosFrag,
          uniforms: {
            uOpacity:  { value: 0.9 },
            uLightDir: { value: new THREE.Vector3(1, 0, 0) },
          },
          transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
        })
        atmosMesh = new THREE.Mesh(new THREE.SphereGeometry(def.size * 1.18, 64, 64), atmosMat_)
        atmosMesh.position.x = def.orbit
        pivot.add(atmosMesh)

        // Lua
        const moonPivot = new THREE.Object3D()
        moonPivot.position.x = def.orbit
        pivot.add(moonPivot)
        const moonMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 })
        const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(def.size * 0.27, 32, 32), moonMat)
        moonMesh.position.x = def.size * 1.8
        moonPivot.add(moonMesh)

        // Salva referência ao moonPivot para girar
        ;(mesh as THREE.Mesh & { moonPivot: THREE.Object3D }).moonPivot = moonPivot

      } else {
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(def.size, 64, 64),
          new THREE.ShaderMaterial({
            vertexShader: planetVert, fragmentShader: def.frag,
            uniforms: { uTime: { value: 0 }, uLightDir: { value: new THREE.Vector3(1, 0, 0) } },
          })
        )
      }

      mesh.position.x  = def.orbit
      mesh.rotation.z  = def.tilt
      pivot.add(mesh)
      planetMeshes.push(mesh)

      // Anel de Saturno
      if (def.hasRing) {
        const ringGeo = new THREE.RingGeometry(def.size * 1.4, def.size * 2.4, 80)
        const ringMat = new THREE.MeshBasicMaterial({
          color: def.ringColor ?? 0xaaaaaa, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
        })
        const ring = new THREE.Mesh(ringGeo, ringMat)
        ring.rotation.x = Math.PI / 2
        mesh.add(ring)
      }
    })

    // ── CÂMERA PATH ──────────────────────────────────────────────────────────
    // Estado da câmera — lerp suave em cada frame
    const cam = {
      px: 0, py: 120, pz: 30,
      lx: 0, ly: 0,   lz: 0,
    }

    const moveTo = (target: Partial<typeof cam>, dur = 2.5) => {
      gsap.to(cam, { ...target, duration: dur, ease: "power2.inOut" })
    }

    // Hero — visão galáctica de cima
    ScrollTrigger.create({
      trigger: "#hero", start: "top top",
      onEnter:     () => moveTo({ px:0, py:120, pz:30, lx:0, ly:0, lz:0 }),
      onEnterBack: () => moveTo({ px:0, py:120, pz:30, lx:0, ly:0, lz:0 }),
    })
    // About — descendo, começa a ver o sistema solar
    ScrollTrigger.create({
      trigger: "#about-section", start: "top 60%",
      onEnter:     () => moveTo({ px:0, py:55, pz:60, lx:0, ly:0, lz:0 }, 3),
      onEnterBack: () => moveTo({ px:0, py:120, pz:30, lx:0, ly:0, lz:0 }, 2),
    })
    // Skills — dentro do sistema solar, visão lateral
    ScrollTrigger.create({
      trigger: "#skills-section", start: "top 60%",
      onEnter:     () => moveTo({ px:20, py:18, pz:50, lx:0, ly:0, lz:0 }, 3),
      onEnterBack: () => moveTo({ px:0, py:55, pz:60, lx:0, ly:0, lz:0 }, 2),
    })
    // Contact — câmera vai até perto da Terra
    ScrollTrigger.create({
      trigger: "#contact-section", start: "top 60%",
      onEnter: () => {
        // Câmera vai para perto da Terra (órbita 16)
        moveTo({ px: earthDef.orbit + 1.5, py: 1.2, pz: 2.5, lx: earthDef.orbit, ly: 0, lz: 0 }, 4)
      },
      onEnterBack: () => moveTo({ px:20, py:18, pz:50, lx:0, ly:0, lz:0 }, 2.5),
    })

    // Mouse parallax sutil
    const mouse = { tx: 0, ty: 0, x: 0, y: 0 }
    const onMouseMove = (e: MouseEvent) => {
      mouse.tx = (e.clientX / window.innerWidth  - 0.5) * 0.25
      mouse.ty = (e.clientY / window.innerHeight - 0.5) * 0.12
    }
    window.addEventListener("mousemove", onMouseMove)
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener("resize", onResize)

    // Entrada — câmera desce do espaço profundo
    gsap.from(cam, { py: 400, pz: 80, duration: 5, ease: "power3.out" })

    // ── LOOP ─────────────────────────────────────────────────────────────────
    let frameId: number
    const clock = new THREE.Clock()

    const animate = () => {
      frameId = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()

      // Mouse
      mouse.x += (mouse.tx - mouse.x) * 0.03
      mouse.y += (mouse.ty - mouse.y) * 0.03

      // Galáxia gira devagar
      galaxy.rotation.y = t * 0.008

      // Sol gira sobre si mesmo
      sun.rotation.y = t * 0.012
      sunMat.uniforms.uTime.value   = t
      cInMat.uniforms.uTime.value   = t
      cOutMat.uniforms.uTime.value  = t
      coronaIn.scale.setScalar(1 + 0.015 * Math.sin(t * 0.7))
      coronaOut.scale.setScalar(1 + 0.010 * Math.sin(t * 0.5 + 1.2))
      sunLight.intensity = 4 + 0.4 * Math.sin(t * 1.4)

      // Planetas orbitam
      planetDefs.forEach((def, i) => {
        planetAngles[i] += def.speed * 0.0008
        planetPivots[i].rotation.y = planetAngles[i]

        // Rotação própria de cada planeta
        planetMeshes[i].rotation.y = t * 0.5

        // Update shader uniforms
        const mat = planetMeshes[i].material as THREE.ShaderMaterial
        if (mat.uniforms?.uTime) mat.uniforms.uTime.value = t

        // Direção da luz solar para cada planeta
        if (mat.uniforms?.uLightDir) {
          const wp = new THREE.Vector3()
          planetMeshes[i].getWorldPosition(wp)
          mat.uniforms.uLightDir.value.copy(new THREE.Vector3().subVectors(new THREE.Vector3(0,0,0), wp).normalize())
        }
      })

      // Terra especial
      if (earthMesh) {
        earthMesh.rotation.z = THREE.MathUtils.degToRad(23.5)
        earthMesh.rotation.y = t * 0.6
        if (earthMat_.uniforms?.uTime) earthMat_.uniforms.uTime.value = t
        const earthWP = new THREE.Vector3()
        earthMesh.getWorldPosition(earthWP)
        const ld = new THREE.Vector3().subVectors(new THREE.Vector3(0,0,0), earthWP).normalize()
        if (earthMat_.uniforms?.uLightDir)  earthMat_.uniforms.uLightDir.value.copy(ld)
        if (atmosMat_.uniforms?.uLightDir)  atmosMat_.uniforms.uLightDir.value.copy(ld)

        // Lua orbita a Terra
        const mp = (earthMesh as THREE.Mesh & { moonPivot?: THREE.Object3D }).moonPivot
        if (mp) mp.rotation.y = t * 1.2
      }

      // Câmera segue o cam state + mouse offset suave
      camera.position.set(
        cam.px + mouse.x * 2,
        cam.py + mouse.y * 2,
        cam.pz
      )
      camera.lookAt(cam.lx, cam.ly, cam.lz)

      renderer.render(scene, camera)
    }
    animate()

    // ── GSAP TEXTO ────────────────────────────────────────────────────────────
    const tl = gsap.timeline({ delay: 1 })
    tl.from(lineRef.current,   { scaleX: 0, duration: 1.2, ease: "power4.inOut", transformOrigin: "left" })
      .from(nameRef.current,   { y: 100, opacity: 0, duration: 1.4, ease: "power4.out" }, "-=0.6")
      .from(scrollRef.current, { opacity: 0, duration: 1, ease: "power2.out" }, "-=0.4")

    if (typedRef.current) {
      const words = ["fullstack.", "criativo.", "eficiente.", "organizado."]
      let i = 0
      const loop = () => {
        gsap.to(typedRef.current, {
          duration: 0.8, text: words[i % words.length], ease: "none",
          onComplete: () => {
            gsap.delayedCall(1.5, () => {
              gsap.to(typedRef.current, {
                duration: 0.4, text: "", ease: "none",
                onComplete: () => { i++; loop() },
              })
            })
          },
        })
      }
      gsap.delayedCall(2.5, loop)
    }

    gsap.from(photoRef.current,     { scrollTrigger: { trigger: "#about-section",   start: "top 80%" }, x: -80, opacity: 0, duration: 1.3, ease: "power3.out" })
    gsap.from(aboutTextRef.current, { scrollTrigger: { trigger: "#about-section",   start: "top 80%" }, x:  80, opacity: 0, duration: 1.3, ease: "power3.out" })
    gsap.from(".skill-card",        { scrollTrigger: { trigger: "#skills-section",  start: "top 75%" }, y:  50, opacity: 0, duration: 0.7, stagger: 0.07, ease: "power3.out" })
    gsap.from(".skill-title",       { scrollTrigger: { trigger: "#skills-section",  start: "top 80%" }, y:  30, opacity: 0, duration: 1,   ease: "power3.out" })
    gsap.from(contactRef.current,   { scrollTrigger: { trigger: "#contact-section", start: "top 75%" }, y:  80, opacity: 0, duration: 1.3, ease: "power3.out" })

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("resize",    onResize)
      renderer.dispose()
      ScrollTrigger.getAll().forEach(st => st.kill())
    }
  }, [])

  const skills = [
    { name: "Next.js",    level: 90 },
    { name: "React",      level: 90 },
    { name: "TypeScript", level: 82 },
    { name: "Node.js",    level: 80 },
    { name: "PostgreSQL", level: 75 },
    { name: "Prisma",     level: 78 },
    { name: "Tailwind",   level: 92 },
    { name: "Three.js",   level: 65 },
  ]

  return (
    <>
      <canvas ref={canvasRef} className="fixed top-0 left-0 w-full h-full" style={{ zIndex: 0 }} />
      <div className="fixed inset-0 pointer-events-none" style={{
        zIndex: 0,
        background: "radial-gradient(ellipse at 50% 50%, transparent 25%, rgba(0,0,8,0.55) 100%)",
      }} />

      {/* HERO */}
      <section id="hero" className="relative min-h-screen flex flex-col items-center justify-center px-6" style={{ zIndex: 1 }}>
        <div className="w-full max-w-5xl">
          <div ref={lineRef} className="h-px w-24 mb-8"
            style={{ background: "linear-gradient(to right, #ffaa44, transparent)" }} />
          <h1 ref={nameRef} className="font-light leading-none mb-6 select-none"
            style={{ fontSize: "clamp(3rem,10vw,9rem)", color: "#fff", letterSpacing: "-0.02em" }}>
            mateus<br />
            <span style={{ color: "rgba(255,255,255,0.15)" }}>henrique</span>
          </h1>
          <p className="text-lg font-light" style={{ color: "rgba(255,255,255,0.35)" }}>
            desenvolvedor{" "}
            <span ref={typedRef} style={{ color: "#ffbb55", minWidth: "120px", display: "inline-block" }} />
          </p>
        </div>
        <div ref={scrollRef} className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
          <span className="text-xs tracking-[0.4em]" style={{ color: "rgba(255,255,255,0.15)" }}>scroll para mergulhar</span>
          <div className="w-px h-16" style={{ background: "linear-gradient(to bottom, rgba(255,180,80,0.5), transparent)" }} />
        </div>
      </section>

      {/* ABOUT */}
      <section id="about-section" className="relative min-h-screen flex items-center px-6 py-24" style={{ zIndex: 1 }}>
        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div ref={photoRef} className="flex justify-center md:justify-start">
            <div className="relative" style={{ width: "320px" }}>
              <div className="absolute inset-0 rounded-2xl" style={{
                background: "radial-gradient(ellipse at center, rgba(255,160,60,0.25) 0%, transparent 70%)",
                transform: "scale(1.15)", filter: "blur(24px)",
              }} />
              <div className="absolute inset-0 rounded-2xl"
                style={{ border: "1px solid rgba(255,160,80,0.25)", borderRadius: "16px" }} />
              <Image src="/mateus.jpg" alt="Mateus Henrique" width={320} height={420}
                className="relative rounded-2xl object-cover object-top"
                style={{ filter: "contrast(1.05) brightness(0.95)", display: "block" }} priority />
              <div className="absolute -bottom-4 -right-4 px-4 py-2 rounded-xl text-xs tracking-widest"
                style={{
                  background: "rgba(10,8,20,0.92)",
                  border: "1px solid rgba(255,160,60,0.3)",
                  color: "rgba(255,180,80,0.9)",
                  backdropFilter: "blur(10px)",
                }}>
                fullstack dev
              </div>
            </div>
          </div>
          <div ref={aboutTextRef}>
            <p className="text-xs tracking-[0.5em] uppercase mb-6" style={{ color: "rgba(255,180,80,0.6)" }}>sobre mim</p>
            <h2 className="font-light leading-relaxed mb-6"
              style={{ fontSize: "clamp(1.4rem,2.5vw,2rem)", color: "rgba(255,255,255,0.9)" }}>
              construo sistemas com foco em clareza, performance e propósito.
            </h2>
            <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
              formado em desenvolvimento de sistemas e informática pela ETEC Alfredo de Barros Santos.
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
              apaixonado por transformar complexidade em código limpo, eficiente e escalável.
            </p>
            <div className="flex gap-6 mt-8">
              {["organização","eficiência","código"].map(tag => (
                <span key={tag} className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,160,60,0.6)" }}>{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SKILLS */}
      <section id="skills-section" className="relative min-h-screen flex items-center px-6 py-24" style={{ zIndex: 1 }}>
        <div ref={skillsRef} className="w-full max-w-5xl mx-auto">
          <p className="skill-title text-xs tracking-[0.5em] uppercase mb-4 text-center" style={{ color: "rgba(255,180,80,0.6)" }}>stack</p>
          <h2 className="skill-title font-light text-center mb-16"
            style={{ fontSize: "clamp(1.8rem,4vw,3.5rem)", color: "rgba(255,255,255,0.9)" }}>tecnologias</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {skills.map(({ name, level }) => (
              <div key={name} className="skill-card"
                style={{
                  border: "1px solid rgba(255,160,60,0.12)", borderRadius: "14px",
                  padding: "1.25rem 1.5rem", background: "rgba(30,20,10,0.35)",
                  backdropFilter: "blur(8px)", transition: "border-color 0.3s, background 0.3s",
                }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor="rgba(255,160,60,0.4)"; el.style.background="rgba(60,40,10,0.4)" }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor="rgba(255,160,60,0.12)"; el.style.background="rgba(30,20,10,0.35)" }}
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm tracking-wider" style={{ color: "rgba(255,255,255,0.8)" }}>{name}</span>
                  <span className="text-xs" style={{ color: "rgba(255,160,60,0.8)" }}>{level}%</span>
                </div>
                <div className="w-full h-px rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full" style={{ width: `${level}%`, background: "linear-gradient(to right, #ff8833, #ffdd66)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact-section" className="relative min-h-screen flex items-center justify-center px-6" style={{ zIndex: 1 }}>
        <div ref={contactRef} className="text-center max-w-2xl">
          <p className="text-xs tracking-[0.5em] uppercase mb-6" style={{ color: "rgba(255,180,80,0.6)" }}>contato</p>
          <h2 className="font-light mb-4 leading-tight"
            style={{ fontSize: "clamp(2.5rem,7vw,6rem)", color: "rgba(255,255,255,0.95)" }}>
            vamos construir<br />
            <span style={{ color: "rgba(255,160,60,0.8)" }}>algo incrível.</span>
          </h2>
          <p className="text-sm mb-12" style={{ color: "rgba(255,255,255,0.3)" }}>
            aberto a projetos, freelas e oportunidades.
          </p>
          <a href="mailto:seu@email.com"
            className="inline-block text-sm tracking-widest uppercase transition-all duration-300"
            style={{
              border: "1px solid rgba(255,160,60,0.35)", color: "rgba(255,255,255,0.6)",
              padding: "1rem 3rem", borderRadius: "100px",
              background: "rgba(80,40,10,0.1)", letterSpacing: "0.2em",
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor="rgba(255,180,80,0.9)"; el.style.color="#fff"; el.style.background="rgba(100,50,10,0.25)"; el.style.boxShadow="0 0 30px rgba(255,140,40,0.2)" }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor="rgba(255,160,60,0.35)"; el.style.color="rgba(255,255,255,0.6)"; el.style.background="rgba(80,40,10,0.1)"; el.style.boxShadow="none" }}
          >
            entrar em contato
          </a>
        </div>
      </section>
    </>
  )
}