// Moving the character the way WoW does: W/S forward and back (backpedalling slower), A/D turn,
// Q/E strafe, Space jump. Left mouse drag turns the camera, right mouse drag turns the character
// with it (and makes A/D strafe), both buttons run forward, the wheel zooms.

import * as THREE from 'three';

const TURN_SPEED = Math.PI; // radians per second, the game's keyboard turn rate
const BACKPEDAL = 4.5 / 7; // backpedalling speed against running
const GRAVITY = 19.3; // yards per second², close to the game's
const JUMP_SPEED = 7.9; // a jump about 1.6 yards high

export class Mover {
	constructor({ dom, camera }) {
		this.dom = dom;
		this.camera = camera;
		this.keys = new Set();
		this.buttons = 0;
		this.position = new THREE.Vector3();
		this.heading = 0; // radians; 0 faces +Z
		this.camYaw = 0;
		this.camPitch = 0.32;
		this.camDistance = 7;
		this.lookHeight = 1.6;
		this.velocityY = 0;
		this.airborne = false;
		this.speed = 7;
		this.enabled = false;
		this.obstacles = []; // [{ position, radius }]
		this.state = { moving: false, airborne: false, turning: 0, direction: 0, backward: false };

		this.onKeyDown = event => {
			if (!this.enabled || event.target.closest?.('input, select, textarea')) return;
			const code = event.code;
			if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
				event.preventDefault();
				this.keys.add(code);
				if (code === 'Space') this.jump();
			}
		};
		this.onKeyUp = event => this.keys.delete(event.code);
		this.onBlur = () => this.keys.clear();
		this.onMouseDown = event => {
			if (!this.enabled) return;
			this.buttons = event.buttons;
			this.dom.setPointerCapture?.(event.pointerId);
		};
		this.onMouseUp = event => {
			this.buttons = event.buttons;
		};
		this.onMouseMove = event => {
			if (!this.enabled || !this.buttons) return;
			this.camYaw -= event.movementX * 0.006;
			this.camPitch = Math.min(1.35, Math.max(-0.35, this.camPitch + event.movementY * 0.005));
			// The right button turns the character with the camera.
			if (this.buttons & 2) this.heading = this.camYaw;
		};
		this.onWheel = event => {
			if (!this.enabled) return;
			event.preventDefault();
			this.camDistance = Math.min(40, Math.max(2.5, this.camDistance * (event.deltaY > 0 ? 1.12 : 1 / 1.12)));
		};
		this.onContextMenu = event => this.enabled && event.preventDefault();
	}

	attach() {
		addEventListener('keydown', this.onKeyDown);
		addEventListener('keyup', this.onKeyUp);
		addEventListener('blur', this.onBlur);
		this.dom.addEventListener('pointerdown', this.onMouseDown);
		addEventListener('pointerup', this.onMouseUp);
		addEventListener('pointermove', this.onMouseMove);
		this.dom.addEventListener('wheel', this.onWheel, { passive: false });
		this.dom.addEventListener('contextmenu', this.onContextMenu);
		this.enabled = true;
	}

	detach() {
		removeEventListener('keydown', this.onKeyDown);
		removeEventListener('keyup', this.onKeyUp);
		removeEventListener('blur', this.onBlur);
		this.dom.removeEventListener('pointerdown', this.onMouseDown);
		removeEventListener('pointerup', this.onMouseUp);
		removeEventListener('pointermove', this.onMouseMove);
		this.dom.removeEventListener('wheel', this.onWheel);
		this.dom.removeEventListener('contextmenu', this.onContextMenu);
		this.enabled = false;
		this.keys.clear();
		this.buttons = 0;
	}

	place(position, heading) {
		this.position.copy(position);
		this.heading = this.camYaw = heading;
		this.velocityY = 0;
		this.airborne = false;
	}

	jump() {
		if (this.airborne) return;
		this.airborne = true;
		this.velocityY = JUMP_SPEED;
		this.jumpedAt = performance.now();
	}

	/** Steps the movement by dt seconds; returns what the character is doing. */
	update(dt) {
		const k = code => this.keys.has(code);
		const mouseRun = (this.buttons & 3) === 3;
		const rightHeld = (this.buttons & 2) !== 0;
		let forward = (k('KeyW') || k('ArrowUp') || mouseRun ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
		let strafe = (k('KeyE') ? 1 : 0) - (k('KeyQ') ? 1 : 0);
		let turn = (k('KeyA') || k('ArrowLeft') ? 1 : 0) - (k('KeyD') || k('ArrowRight') ? 1 : 0);
		// With the right button held, the turn keys strafe instead.
		if (rightHeld && turn) {
			strafe -= turn;
			turn = 0;
		}
		strafe = Math.max(-1, Math.min(1, strafe));

		if (turn) {
			this.heading += turn * TURN_SPEED * dt;
			// Keyboard turning swings the camera with the character.
			if (!this.buttons) this.camYaw = this.heading;
		}

		const moving = forward !== 0 || strafe !== 0;
		const backward = forward < 0;
		let direction = 0; // the angle of travel against the heading, for the body's lean
		if (moving) {
			const sin = Math.sin(this.heading);
			const cos = Math.cos(this.heading);
			// Forward is +Z at heading 0; strafing right is -X.
			const dirX = forward * sin - strafe * cos;
			const dirZ = forward * cos + strafe * sin;
			const length = Math.hypot(dirX, dirZ);
			const speed = this.speed * (backward ? BACKPEDAL : 1);
			const step = new THREE.Vector3(dirX / length, 0, dirZ / length).multiplyScalar(speed * dt);
			this.position.add(step);
			direction = backward ? Math.atan2(strafe, -forward) : Math.atan2(-strafe, forward);
			// The camera eases back behind a running character unless it is being dragged.
			if (!this.buttons) this.camYaw += angleDiff(this.heading, this.camYaw) * Math.min(1, dt * 2.5);
		}

		// Nobody walks through the dummy.
		for (const o of this.obstacles) {
			const dx = this.position.x - o.position.x;
			const dz = this.position.z - o.position.z;
			const d = Math.hypot(dx, dz);
			if (d < o.radius && d > 1e-6) {
				this.position.x = o.position.x + (dx / d) * o.radius;
				this.position.z = o.position.z + (dz / d) * o.radius;
			}
		}

		let landed = false;
		if (this.airborne) {
			this.velocityY -= GRAVITY * dt;
			this.position.y += this.velocityY * dt;
			if (this.position.y <= 0) {
				this.position.y = 0;
				this.airborne = false;
				this.velocityY = 0;
				landed = true;
			}
		}

		this.state = { moving: moving || this.airborne, running: moving, airborne: this.airborne, landed, turning: moving ? 0 : turn, direction, backward };
		return this.state;
	}

	/** Puts the camera behind and above the character, at the zoom distance. */
	updateCamera() {
		const target = this.position.clone().add(new THREE.Vector3(0, this.lookHeight, 0));
		const back = new THREE.Vector3(-Math.sin(this.camYaw) * Math.cos(this.camPitch), Math.sin(this.camPitch), -Math.cos(this.camYaw) * Math.cos(this.camPitch));
		this.camera.position.copy(target).addScaledVector(back, this.camDistance);
		if (this.camera.position.y < 0.3) this.camera.position.y = 0.3;
		this.camera.lookAt(target);
	}
}

/** The shortest signed angle from b to a. */
export function angleDiff(a, b) {
	let d = (a - b) % (Math.PI * 2);
	if (d > Math.PI) d -= Math.PI * 2;
	if (d < -Math.PI) d += Math.PI * 2;
	return d;
}
