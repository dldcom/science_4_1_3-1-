import './style.css';

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('simulation-canvas');
  const ctx = canvas.getContext('2d');
  const container = document.querySelector('.canvas-container');
  
  // Controls
  const btnReset = document.getElementById('btn-reset');
  const bottleVisual = document.getElementById('bottle-visual');
  const bottleWater = document.querySelector('.bottle-water');

  // Menu Elements
  const mainMenu = document.getElementById('main-menu');
  const gameScreen = document.getElementById('game-screen');
  const btnSimulation = document.getElementById('btn-simulation');
  const btnGame = document.getElementById('btn-game');
  const btnHome = document.getElementById('btn-home');
  const stageBadge = document.getElementById('stage-badge');
  const missionText = document.getElementById('mission-text');
  const instructionsCard = document.getElementById('instructions-card');
  const btnNextStage = document.getElementById('btn-next-stage');
  
  // Tool Elements
  const toolSelector = document.getElementById('tool-selector');
  const btnToolWater = document.getElementById('tool-water');
  const btnToolDirt = document.getElementById('tool-dirt');

  // Simulation parameters
  let width, height;
  const numPoints = 200; // Resolution of the terrain
  let terrain = [];
  let particles = [];
  let effects = []; // For floating markers
  
  let isRunning = true;
  let isPouring = false;
  let bottleX = 0;
  let bottleY = 0;

  // Colors
  const COLOR_SOIL = '#8b4513';
  const COLOR_SOIL_DEEP = '#6b3e1c';
  const COLOR_WATER = 'rgba(79, 195, 247, 0.6)';

  function resize() {
    const oldWidth = width;
    const oldHeight = height;
    
    width = container.clientWidth;
    height = container.clientHeight;
    canvas.width = width;
    canvas.height = height;
    
    if (terrain.length > 0 && oldWidth && oldHeight) {
      const scaleX = width / oldWidth;
      const scaleY = height / oldHeight;
      
      // Proportional scale of terrain and rockTerrain heights
      for (let i = 0; i < terrain.length; i++) {
        terrain[i] = terrain[i] * scaleY;
        rockTerrain[i] = rockTerrain[i] * scaleY;
      }
      
      // Proportional scale of fish position and speed
      if (fish) {
        fish.x *= scaleX;
        fish.y *= scaleY;
        fish.vx *= scaleX;
        fish.vy *= scaleY;
      }
      
      // Proportional scale of springs
      for (let s of springs) {
        s.x *= scaleX;
        s.y *= scaleY;
      }
      
      // Proportional scale of active water/dirt particles
      for (let p of particles) {
        p.x *= scaleX;
        p.y *= scaleY;
        p.vx *= scaleX;
        p.vy *= scaleY;
      }
      
      // Proportional scale of bottle position
      bottleX *= scaleX;
      bottleY *= scaleY;
      updateBottlePosition();
    } else if (terrain.length === 0) {
      initTerrain();
      bottleX = width * 0.45; // Default position
      bottleY = height * 0.15; // Default position
      updateBottlePosition();
    }
  }

  window.addEventListener('resize', resize);

  // Game State
  let isSimulationMode = false;
  let currentTool = 'water';
  let currentStage = 0;
  let fish = null; // Replaced plants with a single fish
  let springs = [];
  let stageCleared = false;
  
  let rockTerrain = [];
  const COLOR_ROCK = '#7f8c8d';

  function initTerrain() {
    terrain = [];
    rockTerrain = [];
    fish = null;
    springs = [];
    stageCleared = false;
    
    // Hide modal if open
    document.getElementById('victory-modal').classList.add('hidden');
    // Update badge
    document.getElementById('stage-badge').innerText = `Stage ${currentStage + 1}`;
    
    // Generate Terrain based on Stage
    for(let i=0; i<numPoints; i++) {
      let xProgress = i / numPoints; // 0 to 1
      
      let rockY = height * 0.9; 
      let sandY = rockY;
      
      if (isSimulationMode) {
        // Completely remove bedrock from view
        rockY = height + 100;
        
        // Base flat dirt (moved to the very bottom so there is NO dirt around the hill)
        sandY = height; 
        
        // Add a nice, natural-looking curved mountain with some noise
        if (xProgress > 0.1 && xProgress < 0.9) {
          let hillProgress = (xProgress - 0.1) / 0.8; // 0 to 1
          
          // Base bell curve (sin^2) gives a rounded top and smooth bottom
          let baseHill = Math.pow(Math.sin(hillProgress * Math.PI), 2) * (height * 0.5);
          
          // Add organic noise (mix of frequencies) to make it look like a real mountain, not a math graph
          let noise = (Math.sin(hillProgress * Math.PI * 18) * 0.5 + Math.cos(hillProgress * Math.PI * 27) * 0.5) * (height * 0.04);
          
          // Taper the noise at the edges to blend smoothly into the flat ground
          noise *= Math.sin(hillProgress * Math.PI);
          
          sandY -= (baseHill + noise);
        }
      } else if (currentStage === 0) {
        // Stage 1: Gentle rock slope, blocked by sand
        rockY = height * 0.5 + (xProgress * height * 0.3);
        sandY = rockY; 
        
        // A huge pile of sand blocking the way
        if (xProgress > 0.4 && xProgress < 0.6) {
          let bumpProgress = (xProgress - 0.4) / 0.2; 
          sandY -= Math.sin(bumpProgress * Math.PI) * (height * 0.25);
        }
      } else if (currentStage === 1) {
        // Stage 2: Tiny pit, huge sand pile right next to it
        rockY = height * 0.5 + (xProgress * height * 0.15);
        if (xProgress > 0.45 && xProgress < 0.55) {
          let pitProgress = (xProgress - 0.45) / 0.1;
          rockY += Math.sin(pitProgress * Math.PI) * (height * 0.05); 
        }
        sandY = rockY;
        if (xProgress > 0.3 && xProgress < 0.45) {
          let pileProgress = (xProgress - 0.3) / 0.15;
          sandY -= Math.sin(pileProgress * Math.PI) * (height * 0.2);
        }
      } else if (currentStage === 2) {
        // Stage 3: A huge sand wall that must be eroded
        rockY = height * 0.5 + (xProgress * height * 0.2);
        sandY = rockY;
        if (xProgress > 0.3 && xProgress < 0.6) {
          let blockProgress = (xProgress - 0.3) / 0.3;
          sandY -= Math.sin(blockProgress * Math.PI) * (height * 0.3);
        }
      } else if (currentStage === 3) {
        // Stage 4: Single easy pit instead of double
        rockY = height * 0.45 + (xProgress * height * 0.1);
        if (xProgress > 0.4 && xProgress < 0.5) {
          let pit1 = (xProgress - 0.4) / 0.1;
          rockY += Math.sin(pit1 * Math.PI) * (height * 0.1);
        }
        sandY = rockY;
        if (xProgress > 0.2 && xProgress < 0.4) {
          let pile1 = (xProgress - 0.2) / 0.2;
          sandY -= Math.sin(pile1 * Math.PI) * (height * 0.2);
        }
      } else if (currentStage === 4) {
        // Stage 5: Shallow canyon
        rockY = height * 0.45 + (xProgress * height * 0.05);
        if (xProgress > 0.4 && xProgress < 0.6) {
          let canyon = (xProgress - 0.4) / 0.2;
          rockY += Math.sin(canyon * Math.PI) * (height * 0.15); 
        }
        sandY = rockY;
        if (xProgress > 0.15 && xProgress < 0.4) {
          let supply = (xProgress - 0.15) / 0.25;
          sandY -= Math.sin(supply * Math.PI) * (height * 0.3);
        }
      }
      
      rockY += (Math.random() - 0.5) * 5; // Noise
      sandY += (Math.random() - 0.5) * 5; // Noise
      
      if (sandY > rockY) sandY = rockY; // Sand cannot be lower than bedrock

      rockTerrain.push(rockY);
      terrain.push(sandY);
    }
    
    // --- Pre-settle Terrain ---
    // Run enough iterations so the initial shapes collapse into perfectly stable natural slopes
    for (let k = 0; k < 1000; k++) {
      for (let i = 0; i < numPoints - 1; i++) {
        let diff = terrain[i] - terrain[i + 1];
        let maxSlope = 7.0; // Increased to 7.0 to support steeper, natural curves without crushing them into triangles
        if (Math.abs(diff) > maxSlope) {
          let transfer = (Math.abs(diff) - maxSlope) * 0.4; // Fast transfer for init
          if (diff > 0) {
            // i+1 loses dirt
            let available = rockTerrain[i+1] - terrain[i+1];
            transfer = Math.min(transfer, available);
            terrain[i] -= transfer;
            terrain[i + 1] += transfer;
          } else {
            // i loses dirt
            let available = rockTerrain[i] - terrain[i];
            transfer = Math.min(transfer, available);
            terrain[i] += transfer;
            terrain[i + 1] -= transfer;
          }
        }
      }
    }
    
    // Setup Springs and Fish
    if (!isSimulationMode) {
      springs.push({ x: width * 0.05, y: height * 0.2 });
      fish = { x: width * 0.15, y: getTerrainHeight(width * 0.15) - 20, vx: 0, vy: 0, hp: 200, maxHp: 200 };
    }
    
    particles = [];
    effects = [];
  }

  // --- Physics & Updates ---

  function spawnWater() {
    if (!isPouring) return;
    
    // Constant water pouring rate
    let spawnCount = 8;
    let bottleScale = window.innerWidth <= 900 ? 0.7 : 1.0;
    
    for(let i=0; i<spawnCount; i++) {
      // Bottle tilts counter-clockwise (to the left), so mouth is at bottleX - 25*scale, bottleY - 30*scale
      let px = bottleX - (25 * bottleScale) + (Math.random() * 12 - 6);
      let py = bottleY - (30 * bottleScale) + (Math.random() * 12 - 6);
      
      if (currentTool === 'water') {
        particles.push({
          x: px,
          y: py,
          vx: -3 + (Math.random() * 2), // Spurt slightly to the left/down
          vy: 1 + (Math.random() * 2),
          soilLoad: 0,
          life: 400 + Math.random() * 300, 
          source: 'bottle'
        });
      } else if (currentTool === 'dirt') {
        particles.push({
          x: px,
          y: py,
          vx: -1 + (Math.random() * 2), // Drop more straight down
          vy: 2 + (Math.random() * 2),
          soilLoad: 1.0, // Fully loaded with dirt
          life: 200, 
          source: 'dirt'
        });
      }
    }
  }

  function spawnSpringWater() {
    if (stageCleared) return;
    
    // Springs spawn fewer particles per frame, but constantly
    for (let s of springs) {
      for(let i=0; i<5; i++) { // Keep water volume, but reduce speed
        particles.push({
          x: s.x + (Math.random() * 10 - 5),
          y: s.y + (Math.random() * 10 - 5),
          vx: 1.5 + (Math.random() * 1.5), // Gentle, natural flow to the right
          vy: 2 + (Math.random() * 1),
          soilLoad: 0,
          life: 2500, // Spring water lasts very long so it can reach the end
          source: 'spring'
        });
      }
    }
  }

  function checkVictory() {
    if (stageCleared || !fish) return;
    
    // Victory: Fish reaches the ocean (x > width * 0.9)
    if (fish.x > width * 0.9) {
      stageCleared = true;
      document.getElementById('victory-modal').classList.remove('hidden');
    }
  }

  function getTerrainHeight(x) {
    if (x < 0 || x >= width) return height;
    let idx = Math.floor((x / width) * numPoints);
    if (idx < 0) idx = 0;
    if (idx >= numPoints) idx = numPoints - 1;
    return terrain[idx];
  }

  function modifyTerrain(x, amount) {
    let idx = Math.floor((x / width) * numPoints);
    if (idx >= 0 && idx < numPoints) {
      let oldCenterHeight = terrain[idx];
      
      const indices = [
        { i: idx, w: 1.0 },
        { i: idx - 1, w: 0.6 },
        { i: idx + 1, w: 0.6 },
        { i: idx - 2, w: 0.3 },
        { i: idx + 2, w: 0.3 },
        { i: idx - 3, w: 0.1 },
        { i: idx + 3, w: 0.1 }
      ];
      
      for (let item of indices) {
        if (item.i >= 0 && item.i < numPoints) {
          terrain[item.i] += amount * item.w;
          // Clamp terrain heights to keep within visual limits
          terrain[item.i] = Math.max(height * 0.15, Math.min(height, terrain[item.i]));
          // Bedrock constraint: sand cannot go below bedrock
          if (terrain[item.i] > rockTerrain[item.i]) {
            terrain[item.i] = rockTerrain[item.i];
          }
        }
      }
      
      return terrain[idx] - oldCenterHeight;
    }
    return 0;
  }

  function addEffect(x, y, type, scale = 1) {
    // If it's a high impact effect (scale > 1), bypass the random rate limiting
    if (scale === 1 && Math.random() > 0.08) return; 
    
    let text = '', color = '';
    if (type === 'erosion') { text = '▼'; color = '#ef5350'; }
    if (type === 'transport') { text = '▶'; color = '#ffca28'; }
    if (type === 'deposition') { text = '▲'; color = '#42a5f5'; }
    
    effects.push({ 
      x, 
      y, 
      text, 
      color, 
      life: 60, 
      maxLife: 60, 
      type,
      scale: scale 
    });
  }

  function update() {
    spawnWater();
    spawnSpringWater();

    for (let i = particles.length - 1; i >= 0; i--) {
      let p = particles[i];
      p.vy += 0.5; // Gravity
      p.x += p.vx;
      p.y += p.vy;
      p.life--;

      // Wall Collision
      if (p.x <= 0) {
        if (isSimulationMode) {
          particles.splice(i, 1); // Disappear off the edge
          continue;
        } else {
          p.x = 0;
          p.vx = -p.vx * 0.15; // Block and bounce slightly
        }
      } else if (p.x >= width) {
        if (isSimulationMode) {
          particles.splice(i, 1); // Disappear off the edge
          continue;
        } else {
          p.x = width - 1; 
          p.vx = -p.vx * 0.15; 
        }
      }

      // When particle is about to die, force-deposit any remaining soil
      // This guarantees mass conservation: eroded soil ALWAYS ends up somewhere
      if (p.life <= 0) {
        if (p.soilLoad > 0 && p.x > 0 && p.x < width) {
          let actualDeposit = -modifyTerrain(p.x, -p.soilLoad);
          p.soilLoad -= actualDeposit;
        }
        particles.splice(i, 1);
        continue;
      }

      let th = getTerrainHeight(p.x);
      
      // Collision with terrain
      if (p.y >= th) {
        p.y = th;

        if (p.source === 'dirt') {
          // Dirt particles instantly deposit their soil upon hitting the ground and die
          modifyTerrain(p.x, -p.soilLoad);
          particles.splice(i, 1);
          continue;
        }
        
        let idx = Math.floor((p.x / width) * numPoints);
        if (idx < 0) idx = 0;
        if (idx >= numPoints) idx = numPoints - 1;
        let leftH = idx > 0 ? terrain[idx - 1] : th;
        let rightH = idx < numPoints - 1 ? terrain[idx + 1] : th;
        
        // Calculate slope and clamp it to prevent crazy accelerations
        let slope = rightH - leftH; 
        slope = Math.max(-15, Math.min(15, slope));

        let isSpring = (p.source === 'spring' || p.source === 'lake');

        // Impact Erosion (falling from height)
        // Made much gentler for realistic gradual erosion
        if (p.vy > 4) {
          let erodeAmount = Math.min(p.vy * p.vy * 0.0005, 0.2); 
          
          if (p.soilLoad < 1.0 && !isSpring) {
            let actualErode = modifyTerrain(p.x, erodeAmount);
            p.soilLoad += actualErode;
          }
          
          // Splash! Convert vertical energy to horizontal to blast dirt out of craters
          p.vx += (Math.random() - 0.5) * p.vy * 1.5;
        }

        // --- Flow Physics ---
        let isUphill = (p.vx * slope < 0);
        if (isUphill) {
          p.vx += slope * 0.15; 
        } else {
          p.vx += slope * 0.2; 
        }
        
        // Dampen vertical velocity
        p.vy *= 0.1;
        
        // Friction: heavier (muddy) water slows down MUCH faster
        // This is the key to natural deposition - mud settles quickly
        let baseFriction = isSpring ? 0.97 : 0.92;
        let soilFriction = baseFriction - p.soilLoad * 0.15; // Heavy mud = way more drag
        soilFriction = Math.max(soilFriction, 0.6); // Don't let it freeze instantly
        p.vx *= soilFriction;

        // Clamp maximum horizontal velocity
        p.vx = Math.max(-6, Math.min(6, p.vx));

        let speed = Math.abs(p.vx) + Math.abs(p.vy);

        // Flow Erosion (fast water on a slope, or clean fast water on flat ground)
        if (speed > 2.0 && p.soilLoad < 1.0 && !isSpring) {
          // 경사면: 속도만 빠르면 침식
          // 평지: 흙을 거의 안 들고 있는 맑은 물만 침식 가능
          let canErode = Math.abs(slope) > 0.5 || (p.soilLoad < 0.1 && speed > 3.0);
          if (canErode) {
            let erodeAmount = isSimulationMode ? 0.005 : 0.02; // 시뮬레이션에서는 침식이 더 느림
            let actualErode = modifyTerrain(p.x, erodeAmount);
            p.soilLoad += actualErode;
          }
        } 
        // Deposition: 퇴적 비율 = 1 - (현재 속도 / 최대 속도)
        // 속도 0 → 100% 퇴적, 속도 max → 0% 퇴적
        else if (speed < 2.5 && p.soilLoad > 0.001 && !isSpring) {
          let maxSpeed = 2.5;
          let depositRate = 1.0 - (speed / maxSpeed);
          let depositSpeedMult = isSimulationMode ? 0.025 : 0.1; // 시뮬레이션에서는 퇴적이 더 느림
          let depositAmount = p.soilLoad * depositRate * depositSpeedMult; 
          depositAmount = Math.min(depositAmount, p.soilLoad);
          let actualDeposit = -modifyTerrain(p.x, -depositAmount);
          p.soilLoad -= actualDeposit;
        }
              
      }
    }

    // --- Fish Physics ---
    if (fish && !stageCleared) {
      // Gravity
      fish.vy += 0.5;
      
      fish.x += fish.vx;
      fish.y += fish.vy;

      // Friction
      fish.vx *= 0.9;
      
      // Terrain collision
      let ty = getTerrainHeight(fish.x);
      if (fish.y > ty - 15) {
        fish.y = ty - 15;
        fish.vy = 0;
      }
      
      // Check water depth (only react to spring water!)
      let waterCount = 0;
      for (let p of particles) {
        if (p.source !== 'spring') continue; // Ignore user poured water completely
        
        let dx = p.x - fish.x;
        let dy = p.y - fish.y;
        if (dx*dx + dy*dy < 1600) { // radius 40
          waterCount++;
        }
      }
      
      if (waterCount > 0) { // Require only 1 water particle to swim
        // In water: heal
        fish.hp = Math.min(fish.maxHp, fish.hp + 0.5); 
        
        // ARCADE LOGIC: Constant smooth swimming speed to the right
        // Completely ignores water velocity and slope penalty for frustration-free gameplay!
        fish.vx = 1.5; 
        
        // Float upwards slightly if deep in water
        if (fish.y > ty - 25) fish.vy -= 1.0;
        
      } else {
        // Out of water: take very slow damage (gives user lots of time)
        fish.hp -= 0.05;
        
        // Stranded flop animation
        if (Math.random() < 0.05) {
          fish.vy = -3; // Flop up
          fish.vx = (Math.random() - 0.5) * 2;
        }
        
        if (fish.hp <= 0) {
          // Game Over -> Reset Stage
          initTerrain();
          addEffect(width/2, height/2, 'color', 2.0);
        }
      }
      
      // Check Victory
      checkVictory();
      
      // Boundary collision
      if (fish.x < 10) fish.x = 10;
    }

    for (let i = effects.length - 1; i >= 0; i--) {
      let e = effects[i];
      e.life--;
      e.y -= 1;
      if(e.type === 'transport') e.x += 1;
      if (e.life <= 0) effects.splice(i, 1);
    }

    // --- Thermal Erosion (Soil Slumping) ---
    // Prevents unnaturally steep V-shapes by causing steep dirt to collapse naturally
    for (let i = 0; i < numPoints - 1; i++) {
      let diff = terrain[i] - terrain[i + 1];
      let maxSlope = 7.0; // Supports natural steep curves and dirt stickiness
      
      if (Math.abs(diff) > maxSlope) {
        let transfer = (Math.abs(diff) - maxSlope) * 0.15; 
        if (diff > 0) {
          // i is deeper. Dirt slides from i+1 down to i
          let available = rockTerrain[i+1] - terrain[i+1];
          if (available > 0) {
            transfer = Math.min(transfer, available);
            terrain[i] -= transfer;
            terrain[i + 1] += transfer;
          }
        } else {
          // i+1 is deeper. Dirt slides from i down to i+1
          let available = rockTerrain[i] - terrain[i];
          if (available > 0) {
            transfer = Math.min(transfer, available);
            terrain[i] += transfer;
            terrain[i + 1] -= transfer;
          }
        }
      }
    }
  }

  // --- Rendering ---

  function draw() {
    ctx.clearRect(0, 0, width, height);

    // Draw Sand Layer
    ctx.beginPath();
    ctx.moveTo(0, height);
    for(let i=0; i<numPoints; i++) {
      let x = (i / numPoints) * width;
      ctx.lineTo(x, terrain[i]);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = COLOR_SOIL;
    ctx.fill();

    // Draw Rock Layer (Bedrock)
    ctx.beginPath();
    ctx.moveTo(0, height);
    for(let i=0; i<numPoints; i++) {
      let x = (i / numPoints) * width;
      ctx.lineTo(x, rockTerrain[i]);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = COLOR_ROCK;
    ctx.fill();

    for(let p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.soilLoad > 0.2 ? 4 : 3, 0, Math.PI * 2);
      
      let pColor = COLOR_WATER;
      if (p.source === 'spring') pColor = 'rgba(0, 255, 255, 0.7)';
      if (p.source === 'lake') pColor = 'rgba(41, 128, 200, 0.8)';
      
      if(p.soilLoad > 0.05 && p.source !== 'spring' && p.source !== 'lake') {
        ctx.fillStyle = `rgba(139, 69, 19, ${Math.min(0.8, p.soilLoad * 1.5)})`;
        ctx.fill();
      } else {
        ctx.fillStyle = pColor;
        ctx.fill();
      }
    }

    ctx.textAlign = 'center';
    for(let e of effects) {
      ctx.globalAlpha = e.life / e.maxLife;
      ctx.fillStyle = e.color;
      let fontSize = Math.floor(20 * (e.scale || 1));
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.fillText(e.text, e.x, e.y);
    }
    ctx.globalAlpha = 1.0;

    // Draw Springs
    for (let s of springs) {
      ctx.fillStyle = 'rgba(79, 195, 247, 0.3)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 20 + Math.sin(Date.now() / 150) * 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.font = '20px Arial';
      ctx.fillText('💧', s.x, s.y + 7);
    }

    // Draw Ocean Goal at the right (Only in game mode)
    if (!isSimulationMode) {
      ctx.fillStyle = 'rgba(33, 150, 243, 0.5)';
      ctx.fillRect(width * 0.9, 0, width * 0.1, height);
      ctx.fillStyle = 'white';
      ctx.font = '24px Arial';
      ctx.fillText('바다 (목적지)', width * 0.95, height * 0.2);
    }

    // Draw Fish
    if (fish && !stageCleared) {
      ctx.font = '30px Arial';
      ctx.save();
      ctx.translate(fish.x, fish.y);
      // If flopping out of water, rotate
      if (fish.hp < fish.maxHp && fish.vy < 0 && Math.abs(fish.vx) > 0.5) {
        ctx.rotate(Math.sin(Date.now() / 50) * 0.5);
      } else if (fish.vx > 1) {
        ctx.rotate(0.2); // pointing down slightly
      }
      ctx.fillText('🐟', 0, 0);
      ctx.restore();
      
      // Fish Health Bar
      if (fish.hp < fish.maxHp) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(fish.x - 20, fish.y - 35, 40, 6);
        ctx.fillStyle = fish.hp > 30 ? '#e74c3c' : '#c0392b';
        if (fish.hp < 30 && Math.floor(Date.now() / 200) % 2 === 0) {
          ctx.fillStyle = 'white'; // flash when low health
        }
        ctx.fillRect(fish.x - 20, fish.y - 35, 40 * (Math.max(0, fish.hp) / fish.maxHp), 6);
      }
    }
  }

  function loop() {
    if(isRunning) {
      update();
      draw();
    }
    requestAnimationFrame(loop);
  }

  // --- UI Interactivity ---

  function updateBottlePosition() {
    let scale = window.innerWidth <= 900 ? 0.7 : 1.0;
    let bw = 60 * scale;
    let bh = 120 * scale;
    
    // Center the bottle visually on bottleX, and place spout near bottleY
    bottleVisual.style.left = `${bottleX - bw / 2}px`; 
    bottleVisual.style.top = `${bottleY - bh}px`; 
    
    // Smoothly update the tilt and water visual based on pouring state
    if (isPouring) {
      bottleVisual.style.transform = `scale(${scale}) rotate(-90deg)`;
      bottleWater.style.height = '25%'; // Water looks like it's emptied/pouring out
    } else {
      bottleVisual.style.transform = `scale(${scale}) rotate(-10deg)`;
      bottleWater.style.height = '60%'; // Water filled up to normal level
    }
  }

  // Mouse / Touch tracking on canvas
  function handleMove(e) {
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const rect = canvas.getBoundingClientRect();
    bottleX = clientX - rect.left;
    bottleY = clientY - rect.top;
    
    // Clamp bottle position so it doesn't go off-screen
    if (bottleX < 30) bottleX = 30;
    if (bottleX > width - 30) bottleX = width - 30;
    if (bottleY < 50) bottleY = 50;
    
    // Keep the bottle at least 40px above the terrain height at bottleX
    let groundH = getTerrainHeight(bottleX);
    if (bottleY > groundH - 40) {
      bottleY = groundH - 40;
    }
    
    updateBottlePosition();
  }

  function startPouring(e) {
    isPouring = true;
    handleMove(e);
  }

  function stopPouring() {
    isPouring = false;
    updateBottlePosition();
  }

  // Listeners for moving and clicking
  canvas.addEventListener('mousemove', handleMove);
  canvas.addEventListener('touchmove', handleMove, { passive: true });
  
  canvas.addEventListener('mousedown', startPouring);
  canvas.addEventListener('touchstart', startPouring, { passive: true });
  
  window.addEventListener('mouseup', stopPouring);
  window.addEventListener('touchend', stopPouring);
  canvas.addEventListener('mouseleave', stopPouring);

  btnReset.addEventListener('click', () => {
    initTerrain();
    isPouring = false;
    bottleX = width * 0.45;
    bottleY = height * 0.15;
    updateBottlePosition();
  });

  // Menu Event Listeners
  btnSimulation.addEventListener('click', () => {
    isSimulationMode = true;
    currentTool = 'water';
    
    btnToolWater.classList.add('active');
    btnToolDirt.classList.remove('active');
    toolSelector.classList.remove('hidden');
    
    mainMenu.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    stageBadge.classList.add('hidden');
    missionText.textContent = '자유롭게 물을 부어 침식을 관찰하거나, 흙을 떨어뜨려 산을 만들어보세요!';
    instructionsCard.classList.add('hidden');
    btnNextStage.classList.add('hidden');
    resize(); // Must resize BEFORE initTerrain so height is not 0
    initTerrain();
  });

  btnGame.addEventListener('click', () => {
    isSimulationMode = false;
    currentStage = 0;
    currentTool = 'water';
    toolSelector.classList.add('hidden');
    
    mainMenu.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    stageBadge.classList.remove('hidden');
    stageBadge.textContent = `Stage ${currentStage + 1}`;
    missionText.textContent = '물고기(🐟)를 오른쪽 바다(🌊)까지 안전하게 구출하세요!';
    instructionsCard.classList.remove('hidden');
    btnNextStage.classList.remove('hidden');
    resize();
    initTerrain();
  });

  btnHome.addEventListener('click', () => {
    gameScreen.classList.add('hidden');
    mainMenu.classList.remove('hidden');
    particles = [];
  });
  
  // Tool Selector Events
  btnToolWater.addEventListener('click', () => {
    currentTool = 'water';
    btnToolWater.classList.add('active');
    btnToolDirt.classList.remove('active');
    bottleWater.style.background = 'var(--primary-color)';
  });
  
  btnToolDirt.addEventListener('click', () => {
    currentTool = 'dirt';
    btnToolDirt.classList.add('active');
    btnToolWater.classList.remove('active');
    bottleWater.style.background = 'var(--secondary-color)';
  });

  document.getElementById('btn-next-stage').addEventListener('click', () => {
    currentStage++;
    if (currentStage > 4) {
      currentStage = 0; // Loop back to start
      alert("축하합니다! 모든 스테이지를 클리어했습니다! 🌸 처음부터 다시 시작합니다.");
    }
    stageBadge.textContent = `Stage ${currentStage + 1}`;
    initTerrain();
    isPouring = false;
    document.getElementById('victory-modal').classList.add('hidden');
  });

  const btnTestNext = document.getElementById('btn-test-next');
  if (btnTestNext) {
    btnTestNext.addEventListener('click', () => {
      if (!isSimulationMode) {
        currentStage++;
        if (currentStage > 4) {
          currentStage = 0;
        }
        stageBadge.textContent = `Stage ${currentStage + 1}`;
        initTerrain();
        isPouring = false;
        document.getElementById('victory-modal').classList.add('hidden');
      }
    });
  }

  // --- Mobile Drawer Toggle Events ---
  const btnToggleControls = document.getElementById('btn-toggle-controls');
  const btnCloseControls = document.getElementById('btn-close-controls');
  const controlsPanel = document.getElementById('controls-panel');
  
  if (btnToggleControls && btnCloseControls && controlsPanel) {
    btnToggleControls.addEventListener('click', (e) => {
      e.stopPropagation();
      controlsPanel.classList.add('drawer-open');
    });
    
    btnCloseControls.addEventListener('click', (e) => {
      e.stopPropagation();
      controlsPanel.classList.remove('drawer-open');
    });
    
    // Close drawer when clicking canvas
    canvas.addEventListener('mousedown', () => {
      if (controlsPanel.classList.contains('drawer-open')) {
        controlsPanel.classList.remove('drawer-open');
      }
    });
    canvas.addEventListener('touchstart', () => {
      if (controlsPanel.classList.contains('drawer-open')) {
        controlsPanel.classList.remove('drawer-open');
      }
    });
  }
  
  // --- Collapsible Cards Toggle on Mobile ---
  const conceptReminder = document.querySelector('.concept-reminder');
  
  if (instructionsCard) {
    const instHeader = instructionsCard.querySelector('h4');
    if (instHeader) {
      instHeader.addEventListener('click', () => {
        if (window.innerWidth <= 900) {
          instructionsCard.classList.toggle('collapsed');
        }
      });
    }
  }
  
  if (conceptReminder) {
    const conceptHeader = conceptReminder.querySelector('h4');
    if (conceptHeader) {
      conceptHeader.addEventListener('click', () => {
        if (window.innerWidth <= 900) {
          conceptReminder.classList.toggle('collapsed');
        }
      });
    }
  }

  // Start with menu visible, game hidden (handled by HTML initially)
  // We can skip initial resize drawing until mode is selected to save processing
  resize();
  loop();
});
