function multiply (a, b){
	const transpose = (a) => a[0].map((x, i) => a.map((y) => y[i]));
	const dotproduct = (a, b) => a.map((x, i) => a[i] * b[i]).reduce((m, n) => m + n);
	const result = (a, b) => a.map((x) => transpose(b).map((y) => dotproduct(x, y)));
	return result(a, b);
}

// Defeats the remainder !== modulo JS bug/feature
function modulo(n, m){
	return ((n % m) + m) % m;
}

function clamp(value, min, max){
	if (value < min){
		return min;
	} else if (value > max){
		return max;
	} else {
		return value;
	}
}

class Projector {
	fov = 0;
	v = 0;
	screenEdgeX = 0;
	screenEdgeY = 0;
	width = 0;
	height = 0;

	static rotationMatrix(cam, org = {x: 0, y: 0, z: -1}){
		const v = { // cross product org x cam
			x: org.y * cam.z - org.z * cam.y,
			y: -(org.x * cam.z - org.z * cam.x),
			z: org.x * cam.y - org.y * cam.x
		};

		const s = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z); // size of vector v

		const c = cam.x * org.x + cam.y * org.y + cam.z * org.z; // dot product cam . org

		// console.log("v", v);
		// console.log("s", s);
		// console.log("c", c);

		// R = I + [v]x + [v]x**2 * (1 - c) / (s**2)
		let R = [
			[1,    -v.z,  v.y],
			[v.z,  1,    -v.x],
			[-v.y, v.x,   1  ]
		];

		const vx = [
			[0,    -v.z,  v.y],
			[v.z,  0,    -v.x],
			[-v.y, v.x,   0  ]
		];

		const vx_square = multiply(vx, vx)

		// console.log(vx_square);

		const vx_square_multiplicator = (1 - c) / (s * s);

		// mulitply matrix by multiplicator
		for (let i = 0; i < 3; i++){
			for (let j = 0; j < 3; j++){
				vx_square[i][j] *= vx_square_multiplicator;
			}
		}

		for (let i = 0; i < 3; i++){
			for (let j = 0; j < 3; j++){
				R[i][j] += vx_square[i][j];
			}
		}

		// console.log(R);

		return R;
	}

	static rotatePoint(pt, R){
		const result = {};
		[[result.x], [result.y], [result.z]] = multiply(R, [[pt.x], [pt.y], [pt.z]]);
		return result;
	}

	static approximateFovFromAspectRatio(ratio){
		return -12.4514286 * ratio * ratio + 74.6538095 * ratio + 28.2992857;
	}

	static correctX(x, screenCenter){
		const distance = x - screenCenter;
		const correction = -5.604080619E-4 * distance * distance + 0.07924427173 * distance - 3.43760189;
		console.log(x, screenCentery);
		return x + (-5.604080619E-4 * distance * distance + 0.07924427173 * distance - 3.43760189);
	}

	static updateFov(width, height){
		this.width = width;
		this.height = height;

		this.fov = (Projector.approximateFovFromAspectRatio(width / height)) / 180 * Math.PI;

		const m = width / height;

		const squaredCtgHalfFov = (1 / Math.tan(this.fov / 2)) ** 2;

		this.v = squaredCtgHalfFov / (1 + 1 / (m * m) + squaredCtgHalfFov);

		const screenEdgeAngle = Math.atan(1 / m); // rad
		const screenCircumscribedRadius = Math.sin(Math.acos(this.v));
		this.screenEdgeX = Math.cos(screenEdgeAngle) * screenCircumscribedRadius;
		this.screenEdgeY = Math.sin(screenEdgeAngle) * screenCircumscribedRadius;
	}

	static projectPoint(point){
		const c = this.v / point.z;

		return {
			x: point.x * c,
			y: point.y * c
		};
	}

	static projectPointV2(point, cameraVector){
		const camY = Math.asin(cameraVector.y);
		const ptY = Math.asin(point.y);
		
		// Projects the vector to the XZ plane, then normalizes it
		// to properly compute asin and acos
		const cameraNormXZ = 1 / Math.sqrt(cameraVector.x * cameraVector.x + cameraVector.z * cameraVector.z);
		const camZnormalized = cameraVector.z * cameraNormXZ;
		const camZ = Math.acos(camZnormalized);

		const pointNormXZ = 1 / Math.sqrt(point.x * point.x + point.z * point.z);
		const pointZnormalized = point.z * pointNormXZ;
		const ptZ = Math.acos(pointZnormalized);

		const camXZ = cameraVector.x > 0 ? camZ : 2 * Math.PI - camZ;
		let ptXZ = point.x > 0 ? ptZ : 2 * Math.PI - ptZ;

		// evil hack to fight circle wrapping
		if (ptXZ < camXZ - 0.5 * this.fov){
			while (ptXZ + 2 * Math.PI < camXZ + 0.5 * this.fov){
				ptXZ += 2 * Math.PI;
			}
		}
		if (ptXZ > camXZ + 0.5 * this.fov){
			while (ptXZ - 2 * Math.PI > camXZ - 0.5 * this.fov){
				ptXZ -= 2 * Math.PI;
			}
		}

		// console.log("cam s", (camXZ - 1/2 * this.fov) * 180 / Math.PI);
		// console.log("cam e", (camXZ + 1/2 * this.fov) * 180 / Math.PI);
		// console.log("pt", ptXZ * 180 / Math.PI);

		// console.log(camZ * 180 / Math.PI, camXZ * 180 / Math.PI);
		// if (Date.now() % 1000 < 17){
		// 	console.log((ptX - camXZ) / this.fov);
		// }

		let x = 0.5 - (ptXZ - camXZ) / this.fov;
		let y = 0.5 - (ptY - camY) / (0.5 * Math.PI);


		//console.log("tada", ptXZ - camXZ);
		// correction
		// const xDiff = Math.abs(0.5 - x);
		// const xCorrection = Math.abs(xDiff * xDiff * 0.2);
		// if (x < 0.5){
		// 	x += xCorrection;
		// } else {
		// 	x -= xCorrection;
		// }
		
		x -= 0.5;
		// x *= -Math.sin(clamp(6 * x, -0.5, 0.5) - 1.5 * Math.PI) + 1.66;
		const cx = clamp(x, -0.4, 0.4);
		x *= 1.7 * cx * cx + 0.66 - this.width/this.height * 0.041;
		
		x += 0.5;
		// const threshold = 0.33 * this.height / this.width;
		// if (Math.abs(x) > threshold){
		// 	console.log("correct");
		// 	if (x < 0){
		// 		x -= (x + threshold) ** 2;
		// 	} else {
		// 		x += (x - threshold) ** 2;
		// 	}
		// }


		y -= 0.5;
		const cy = clamp(y, -0.46, 0.46);
		y *= 1.1 * cy * cy + 0.78;
		y += 0.5;
		// const yCorrection = Math.abs(0.07 * (0.5 - y) * (0.5 - y));

		//console.log(point.x * cameraVector.x + point.y * cameraVector.y + point.z * cameraVector.z);

		console.log(point.x * cameraVector.x + point.y * cameraVector.y + point.z * cameraVector.z);

		return {
			x: x * this.width,
			y: y * this.height,
			inSight: (point.x * cameraVector.x + point.y * cameraVector.y + point.z * cameraVector.z) > 0 // dot product of 2
		}
	}

	static planeToScreen(point){
		return {
			x: (point.x + this.screenEdgeX) / (this.screenEdgeX * 2) * this.width,
			y: (point.y + this.screenEdgeY) / (this.screenEdgeY * 2) * this.height
		}
	}
	
	static isInDrawCircle(screenPoint){
		const x = (screenPoint.x - 0.5 * this.width);
		const y = (screenPoint.y - 0.5 * this.height);
		const r = Math.min(this.width, this.height) / 2;
		return x * x + y * y < r * r;
	}
}

class Game {
	constructor(source){
		this.scenes = {};
		this.videos = {};
		
		for (const scene of source.scenes){
			this.scenes[scene.name] = new Scene(scene);
		}
		
		for (const video of source.videos){
			this.videos[video.name] = new Video(video);
		}
		
		this.goTo("vestibul", true);

		setTimeout(() => {this.loop()}, 1000)
	}

	goTo(name, first=false){
		if (!first){
			this.currentScene.hideHitboxes();
		}
		
		this.currentScene = this.scenes[name];
		console.log(this.scenes);
		document.querySelector("video").src = this.currentScene.source;

		this.currentScene.displayHitboxes();
	}

	frame(){
		return new Promise(requestAnimationFrame);
	}
	async loop(){
		while (true){
			while (vr.cameraVector === undefined){
				await this.frame();
			}

			const rotationMatrix = Projector.rotationMatrix(vr.cameraVector);

			for (const hitbox of this.currentScene.hitboxes){
				hitbox.update(rotationMatrix);
			}

			await this.frame();
		}
	}
}

class Scene {
	constructor(source){
		this.name = source.name;
		this.location = source.location;
		this.source = source.source;
		this.hitboxes = [];

		for (const hitbox of source.hitboxes){
			this.hitboxes.push(new Hitbox(hitbox));
		}
	}

	displayHitboxes(){
		for (const hitbox of this.hitboxes){
			hitbox.display();
		}
	}
	
	hideHitboxes(){
		for (const hitbox of this.hitboxes){
			hitbox.hide();
		}
	}
}

class Video {
	constructor(source){
		
	}
}

class Hitbox {
	constructor(source){
		this.element = document.createElement("div");
		this.element.classList.add("hitbox");

		this.tooltip = source.tooltip;
		this.tooltipElement = document.createElement("div");
		this.tooltipElement.textContent = this.tooltip;
		this.tooltipElement.classList.add("tooltip");
		this.element.appendChild(this.tooltipElement);

		this.point = {};
		[this.point.x, this.point.y, this.point.z] = source.point;

		const norm = 1 / Math.sqrt(this.point.x * this.point.x + this.point.y * this.point.y + this.point.z * this.point.z);
		this.point.x *= norm;
		this.point.y *= norm;
		this.point.z *= norm;

		this.target = source.target;

		this.element.addEventListener("click", () => {
			game.goTo(this.target);
			console.log(this.target);
		});
	}

	display(){
		document.body.appendChild(this.element);
	}

	hide(){
		this.element.remove();
	}

	update(){
		// const rotated = Projector.rotatePoint(this.point, rotationMatrix);
		// this.element.hidden = Projector.v < rotated.z;

		// if (this.element.hidden){
		// 	return;
		// }

		// const inPlane = Projector.projectPoint(rotated);
		// const onScreen = Projector.planeToScreen(inPlane);

		const onScreen = Projector.projectPointV2(this.point, vr.cameraVector);

		if (Projector.isInDrawCircle(onScreen)){
			this.element.classList.remove("hidden");
		} else {
			this.element.classList.add("hidden");
		}

		if (onScreen.inSight){
			this.element.style.display = "block";
		} else {
			this.element.style.display = "none";
		}

		this.element.style.left = onScreen.x + "px";
		this.element.style.top = onScreen.y + "px";
	}
}


fetch("game.json")
.then(async (res) => {
	const body = await res.json();
	window.game = new Game(body);
});