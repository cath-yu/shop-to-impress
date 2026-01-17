import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment } from '@react-three/drei';

function Model({ url }) {
  // useGLTF loads the file. For VRM, we use the 'scene' property.
  const { scene } = useGLTF(url);
  
  return <primitive object={scene} position={[0, -1, 0]} />;
}

export default function CharacterStage() {
  // Use a public URL for a VRM model or place yours in the /public folder
  const testModelUrl = "../../public/models/4163253887066579338.vrm"; 

  return (
    <div style={{ width: '100%', height: '600px', background: '#f0f0f0', borderRadius: '15px', overflow: 'hidden' }}>
      <Canvas camera={{ position: [0, 1, 3.5], fov: 45 }}>
        <Suspense fallback={null}>
          <Environment preset="city" /> 
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
          
          <Model url={testModelUrl} />
          
          {/* Allows you to rotate the character to see the front/back */}
          <OrbitControls enablePan={false} minDistance={2} maxDistance={5} />
        </Suspense>
      </Canvas>
    </div>
  );
}