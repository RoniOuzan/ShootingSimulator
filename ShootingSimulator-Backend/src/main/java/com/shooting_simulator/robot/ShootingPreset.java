package com.shooting_simulator.robot;

import com.shooting_simulator.util.math.geometry.Rotation2d;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ShootingPreset {
    private final Rotation2d pitch;
    private final Rotation2d yaw;
    private final double velocity;

    private final double dPitch; // radians
    private final double dYaw; // radians
    private final double dVelocity;

    private final double flightTime;

//    public Translation3d getTranslation3d() {
//        return new Translation3d(this.velocity,
//                new Rotation3d(0, -this.pitch.getRadians(), this.yaw.getRadians()));
//    }
}
