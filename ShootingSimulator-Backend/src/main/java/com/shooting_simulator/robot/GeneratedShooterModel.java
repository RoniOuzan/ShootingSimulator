package com.shooting_simulator.robot;

// 15m generated 8000 points - orbit resolution
public class GeneratedShooterModel extends ShootingModel {

    @Override
    protected double getMinAngle() { return 50; }

    @Override
    protected double getMaxAngle() { return 90; }

    @Override
    protected double getTargetRadius() { return 0.3; }

    // === OPTIMAL ANGLE TARGETS ===

    @Override
    public double getAngle(double d, double vr) {
        return (88.4053934643) -
                (10.6373319013 * d) -
                (8.9982403736 * vr) +
                (2.1925977665 * d * d) +
                (1.1545887331 * d * vr) +
                (0.1762175643 * vr * vr) -
                (0.3726546556 * d * d * d) -
                (0.1632893498 * d * d * vr) +
                (0.0111780376 * d * vr * vr) +
                (0.0317189893 * vr * vr * vr) +
                (0.0378114649 * d * d * d * d) +
                (0.0180605573 * d * d * d * vr) -
                (0.0019660936 * d * d * vr * vr) -
                (0.0052134399 * d * vr * vr * vr) -
                (0.0000902827 * vr * vr * vr * vr) -
                (0.0016372051 * d * d * d * d * d) -
                (0.0008470735 * d * d * d * d * vr) +
                (0.0002533790 * d * d * d * vr * vr) +
                (0.0004813504 * d * d * vr * vr * vr) -
                (0.0000334272 * d * vr * vr * vr * vr) -
                (0.0001361469 * vr * vr * vr * vr * vr);
    }
    @Override
    public double getAngleDerivativeDistance(double d, double vr) {
        return  -
                (10.6373319013) +
                (4.3851955330 * d) +
                (1.1545887331 * vr) -
                (1.1179639668 * d * d) -
                (0.3265786996 * d * vr) +
                (0.0111780376 * vr * vr) +
                (0.1512458597 * d * d * d) +
                (0.0541816719 * d * d * vr) -
                (0.0039321872 * d * vr * vr) -
                (0.0052134399 * vr * vr * vr) -
                (0.0081860254 * d * d * d * d) -
                (0.0033882938 * d * d * d * vr) +
                (0.0007601371 * d * d * vr * vr) +
                (0.0009627008 * d * vr * vr * vr) -
                (0.0000334272 * vr * vr * vr * vr);
    }
    @Override
    public double getAngleDerivativeRadialVelocity(double d, double vr) {
        return  -
                (8.9982403736) +
                (1.1545887331 * d) +
                (0.3524351286 * vr) -
                (0.1632893498 * d * d) +
                (0.0223560752 * d * vr) +
                (0.0951569678 * vr * vr) +
                (0.0180605573 * d * d * d) -
                (0.0039321872 * d * d * vr) -
                (0.0156403196 * d * vr * vr) -
                (0.0003611309 * vr * vr * vr) -
                (0.0008470735 * d * d * d * d) +
                (0.0005067581 * d * d * d * vr) +
                (0.0014440511 * d * d * vr * vr) -
                (0.0001337090 * d * vr * vr * vr) -
                (0.0006807346 * vr * vr * vr * vr);
    }

    // === OPTIMAL VELOCITY TARGETS ===

    @Override
    public double getVelocityNormal(double d, double vr) {
        return (6.3726209883) +
                (0.5696804924 * d) +
                (0.0627972146 * vr) +
                (0.0272403725 * d * d) +
                (0.1676524215 * d * vr) +
                (0.0716637732 * vr * vr) -
                (0.0087736289 * d * d * d) -
                (0.0351183098 * d * d * vr) -
                (0.0176793137 * d * vr * vr) -
                (0.0026534989 * vr * vr * vr) +
                (0.0010921432 * d * d * d * d) +
                (0.0047160413 * d * d * d * vr) +
                (0.0034678549 * d * d * vr * vr) +
                (0.0013835903 * d * vr * vr * vr) +
                (0.0002703659 * vr * vr * vr * vr) -
                (0.0000498662 * d * d * d * d * d) -
                (0.0002520642 * d * d * d * d * vr) -
                (0.0002463328 * d * d * d * vr * vr) -
                (0.0001621326 * d * d * vr * vr * vr) -
                (0.0000815845 * d * vr * vr * vr * vr) -
                (0.0000293509 * vr * vr * vr * vr * vr);
    }
    @Override
    public double getVelocityNormalDerivativeDistance(double d, double vr) {
        return (0.5696804924) +
                (0.0544807450 * d) +
                (0.1676524215 * vr) -
                (0.0263208866 * d * d) -
                (0.0702366196 * d * vr) -
                (0.0176793137 * vr * vr) +
                (0.0043685730 * d * d * d) +
                (0.0141481240 * d * d * vr) +
                (0.0069357098 * d * vr * vr) +
                (0.0013835903 * vr * vr * vr) -
                (0.0002493312 * d * d * d * d) -
                (0.0010082568 * d * d * d * vr) -
                (0.0007389985 * d * d * vr * vr) -
                (0.0003242652 * d * vr * vr * vr) -
                (0.0000815845 * vr * vr * vr * vr);
    }
    @Override
    public double getVelocityNormalDerivativeRadialVelocity(double d, double vr) {
        return (0.0627972146) +
                (0.1676524215 * d) +
                (0.1433275465 * vr) -
                (0.0351183098 * d * d) -
                (0.0353586275 * d * vr) -
                (0.0079604967 * vr * vr) +
                (0.0047160413 * d * d * d) +
                (0.0069357098 * d * d * vr) +
                (0.0041507710 * d * vr * vr) +
                (0.0010814635 * vr * vr * vr) -
                (0.0002520642 * d * d * d * d) -
                (0.0004926657 * d * d * d * vr) -
                (0.0004863977 * d * d * vr * vr) -
                (0.0003263381 * d * vr * vr * vr) -
                (0.0001467543 * vr * vr * vr * vr);
    }

    @Override
    public double getVelocityMinAngle(double d, double vr) {
        return (2.7719533667) +
                (1.5927055180 * d) +
                (2.6230410635 * vr) -
                (0.1303197742 * d * d) -
                (0.4129684418 * d * vr) -
                (0.7797605395 * vr * vr) +
                (0.0106701781 * d * d * d) +
                (0.0250486629 * d * d * vr) +
                (0.1267765511 * d * vr * vr) +
                (0.1261191871 * vr * vr * vr) -
                (0.0004518136 * d * d * d * d) -
                (0.0002898919 * d * d * d * vr) -
                (0.0042887867 * d * d * vr * vr) -
                (0.0104058202 * d * vr * vr * vr) -
                (0.0062695452 * vr * vr * vr * vr);
    }
    @Override
    public double getVelocityMinAngleDerivativeDistance(double d, double vr) {
        return (1.5927055180) -
                (0.2606395483 * d) -
                (0.4129684418 * vr) +
                (0.0320105343 * d * d) +
                (0.0500973258 * d * vr) +
                (0.1267765511 * vr * vr) -
                (0.0018072543 * d * d * d) -
                (0.0008696757 * d * d * vr) -
                (0.0085775735 * d * vr * vr) -
                (0.0104058202 * vr * vr * vr);
    }
    @Override
    public double getVelocityMinAngleDerivativeRadialVelocity(double d, double vr) {
        return (2.6230410635) -
                (0.4129684418 * d) -
                (1.5595210791 * vr) +
                (0.0250486629 * d * d) +
                (0.2535531023 * d * vr) +
                (0.3783575613 * vr * vr) -
                (0.0002898919 * d * d * d) -
                (0.0085775735 * d * d * vr) -
                (0.0312174605 * d * vr * vr) -
                (0.0250781807 * vr * vr * vr);
    }

    @Override
    public double getVelocityMaxAngle(double d, double vr) {
        return (7.0081964617) +
                (3.8197713662 * d) +
                (3.2474197038 * vr) +
                (1.6135361893 * d * d) +
                (4.0999058858 * d * vr) +
                (2.2935658786 * vr * vr) +
                (0.0072980265 * d * d * d) +
                (0.3648977447 * d * d * vr) +
                (0.7599421851 * d * vr * vr) +
                (0.3822720191 * vr * vr * vr);
    }
    @Override
    public double getVelocityMaxAngleDerivativeDistance(double d, double vr) {
        return (3.8197713662) +
                (3.2270723786 * d) +
                (4.0999058858 * vr) +
                (0.0218940794 * d * d) +
                (0.7297954895 * d * vr) +
                (0.7599421851 * vr * vr);
    }
    @Override
    public double getVelocityMaxAngleDerivativeRadialVelocity(double d, double vr) {
        return (3.2474197038) +
                (4.0999058858 * d) +
                (4.5871317573 * vr) +
                (0.3648977447 * d * d) +
                (1.5198843703 * d * vr) +
                (1.1468160572 * vr * vr);
    }

    // === FLIGHT TIME TARGETS ===

    @Override
    public double getFlightTimeNormal(double d, double vr) {
        return (0.7157361081) +
                (0.2368701522 * d) +
                (0.0122962062 * vr) -
                (0.0512028148 * d * d) -
                (0.0043935101 * d * vr) -
                (0.0029255743 * vr * vr) +
                (0.0095039749 * d * d * d) -
                (0.0006772368 * d * d * vr) -
                (0.0015853910 * d * vr * vr) -
                (0.0003614940 * vr * vr * vr) -
                (0.0010134990 * d * d * d * d) +
                (0.0002367614 * d * d * d * vr) +
                (0.0005334314 * d * d * vr * vr) +
                (0.0003247642 * d * vr * vr * vr) +
                (0.0001143545 * vr * vr * vr * vr) +
                (0.0000457818 * d * d * d * d * d) -
                (0.0000144391 * d * d * d * d * vr) -
                (0.0000364974 * d * d * d * vr * vr) -
                (0.0000288756 * d * d * vr * vr * vr) -
                (0.0000175309 * d * vr * vr * vr * vr) -
                (0.0000054135 * vr * vr * vr * vr * vr);
    }

    @Override
    public double getFlightTimeMinAngle(double d, double vr) {
        return  -
                (0.0889411680) +
                (0.6421839446 * d) -
                (0.3639604561 * vr) -
                (0.1388591714 * d * d) +
                (0.0100959074 * d * vr) +
                (0.2247337904 * vr * vr) +
                (0.0150036509 * d * d * d) +
                (0.0124275046 * d * d * vr) -
                (0.0215333853 * d * vr * vr) -
                (0.0326376099 * vr * vr * vr) -
                (0.0005994604 * d * d * d * d) -
                (0.0009312363 * d * d * d * vr) +
                (0.0001552324 * d * d * vr * vr) +
                (0.0018654564 * d * vr * vr * vr) +
                (0.0017545494 * vr * vr * vr * vr);
    }

    @Override
    public double getFlightTimeMaxAngle(double d, double vr) {
        return (0.9918478132) +
                (1.4793839098 * d) +
                (1.2901594480 * vr) +
                (0.1660437760 * d * d) +
                (0.8368869983 * d * vr) +
                (0.5962653593 * vr * vr) +
                (0.0110674312 * d * d * d) +
                (0.0696213872 * d * d * vr) +
                (0.1602533343 * d * vr * vr) +
                (0.0927704434 * vr * vr * vr);
    }

    // === POS VELOCITY TOLERANCE TARGETS ===

    @Override
    public double getToleranceVelPositiveNormal(double d, double vr) {
        return (1.2187004673) -
                (0.9258671389 * d) -
                (0.3074599860 * vr) +
                (0.4156214282 * d * d) +
                (0.2487096138 * d * vr) +
                (0.0506490478 * vr * vr) -
                (0.0996167420 * d * d * d) -
                (0.0851902205 * d * d * vr) -
                (0.0317278329 * d * vr * vr) -
                (0.0040552189 * vr * vr * vr) +
                (0.0120243388 * d * d * d * d) +
                (0.0133050906 * d * d * d * vr) +
                (0.0070875350 * d * d * vr * vr) +
                (0.0017259824 * d * vr * vr * vr) +
                (0.0001306811 * vr * vr * vr * vr) -
                (0.0005736070 * d * d * d * d * d) -
                (0.0007749260 * d * d * d * d * vr) -
                (0.0005305319 * d * d * d * vr * vr) -
                (0.0001846394 * d * d * vr * vr * vr) -
                (0.0000265941 * d * vr * vr * vr * vr) -
                (0.0000010038 * vr * vr * vr * vr * vr);
    }

    @Override
    public double getToleranceVelPositiveMinAngle(double d, double vr) {
        return  -
                (0.1402492962) +
                (0.0857279524 * d) +
                (0.2238172944 * vr) -
                (0.0052074761 * d * d) -
                (0.0455145826 * d * vr) -
                (0.0276368020 * vr * vr) -
                (0.0000766077 * d * d * d) +
                (0.0024033798 * d * d * vr) +
                (0.0030797928 * d * vr * vr) +
                (0.0010192078 * vr * vr * vr);
    }

    @Override
    public double getToleranceVelPositiveMaxAngle(double d, double vr) {
        return (3.7805477604) +
                (8.4634235948 * d) +
                (11.3613918275 * vr) -
                (3.2007797062 * d * d) +
                (3.3920148015 * d * vr) +
                (7.4360483885 * vr * vr) -
                (1.2092807144 * d * d * d) -
                (5.9040167928 * d * d * vr) -
                (3.6785414945 * d * vr * vr) +
                (1.0480332226 * vr * vr * vr) +
                (0.6974175610 * d * d * d * d) +
                (1.7907135934 * d * d * d * vr) +
                (0.7120715827 * d * d * vr * vr) -
                (0.2287588045 * d * vr * vr * vr) +
                (0.1257072370 * vr * vr * vr * vr) +
                (0.2716978714 * d * d * d * d * d) +
                (1.4443649203 * d * d * d * d * vr) +
                (2.8918841481 * d * d * d * vr * vr) +
                (2.7004331052 * d * d * vr * vr * vr) +
                (1.2157669663 * d * vr * vr * vr * vr) +
                (0.2310636491 * vr * vr * vr * vr * vr);
    }

    // === NEG VELOCITY TOLERANCE TARGETS ===

    @Override
    public double getToleranceVelNegativeNormal(double d, double vr) {
        return (1.0723383565) -
                (0.7272706023 * d) -
                (0.2283679769 * vr) +
                (0.3085678843 * d * d) +
                (0.1688813504 * d * vr) +
                (0.0330529243 * vr * vr) -
                (0.0715492112 * d * d * d) -
                (0.0549265923 * d * d * vr) -
                (0.0190430685 * d * vr * vr) -
                (0.0021125878 * vr * vr * vr) +
                (0.0084658459 * d * d * d * d) +
                (0.0083199866 * d * d * d * vr) +
                (0.0040686201 * d * d * vr * vr) +
                (0.0008497502 * d * vr * vr * vr) +
                (0.0000354147 * vr * vr * vr * vr) -
                (0.0003990187 * d * d * d * d * d) -
                (0.0004754514 * d * d * d * d * vr) -
                (0.0002964534 * d * d * d * vr * vr) -
                (0.0000875944 * d * d * vr * vr * vr) -
                (0.0000070103 * d * vr * vr * vr * vr) +
                (0.0000003389 * vr * vr * vr * vr * vr);
    }

    @Override
    public double getToleranceVelNegativeMinAngle(double d, double vr) {
        return  -
                (0.2465096408) +
                (0.1182116666 * d) +
                (0.2750650257 * vr) -
                (0.0084917964 * d * d) -
                (0.0560105018 * d * vr) -
                (0.0353253043 * vr * vr) +
                (0.0000270541 * d * d * d) +
                (0.0029661224 * d * d * vr) +
                (0.0038405742 * d * vr * vr) +
                (0.0014133315 * vr * vr * vr);
    }

    @Override
    public double getToleranceVelNegativeMaxAngle(double d, double vr) {
        return (4.6279721931) +
                (8.2684080303 * d) +
                (13.3421841264 * vr) -
                (15.6191017516 * d * d) -
                (17.8403017521 * d * vr) +
                (0.2554611117 * vr * vr) +
                (9.4574620873 * d * d * d) +
                (10.5098802149 * d * d * vr) +
                (0.9971433934 * d * vr * vr) +
                (0.4964605570 * vr * vr * vr) -
                (1.3030592557 * d * d * d * d) +
                (0.2979814708 * d * d * d * vr) +
                (2.4338468909 * d * d * vr * vr) +
                (0.9667795673 * d * vr * vr * vr) +
                (0.1792629929 * vr * vr * vr * vr) -
                (0.8562762588 * d * d * d * d * d) -
                (4.2971864194 * d * d * d * d * vr) -
                (7.8637835681 * d * d * d * vr * vr) -
                (7.0697879791 * d * d * vr * vr * vr) -
                (3.2482171953 * d * vr * vr * vr * vr) -
                (0.6014092043 * vr * vr * vr * vr * vr);
    }

    // === POS ANGLE TOLERANCE TARGETS ===

    @Override
    public double getToleranceAnglePositiveNormal(double d, double vr) {
        return (3.7359226376) -
                (0.8594581665 * d) +
                (0.0905788875 * vr) +
                (0.3056284564 * d * d) +
                (0.0759046735 * d * vr) +
                (0.0087277508 * vr * vr) -
                (0.0605319297 * d * d * d) -
                (0.0100296044 * d * d * vr) +
                (0.0176223611 * d * vr * vr) +
                (0.0008049160 * vr * vr * vr) +
                (0.0067396445 * d * d * d * d) +
                (0.0019531344 * d * d * d * vr) -
                (0.0005183359 * d * d * vr * vr) +
                (0.0033884611 * d * vr * vr * vr) +
                (0.0003315548 * vr * vr * vr * vr) -
                (0.0003108731 * d * d * d * d * d) -
                (0.0001378971 * d * d * d * d * vr) -
                (0.0000808330 * d * d * d * vr * vr) -
                (0.0003016813 * d * d * vr * vr * vr) +
                (0.0001101892 * d * vr * vr * vr * vr) +
                (0.0000371994 * vr * vr * vr * vr * vr);
    }

    @Override
    public double getToleranceAnglePositiveMinAngle(double d, double vr) {
        return (125.9867099402) -
                (32.5117228969 * d) -
                (56.2147152759 * vr) +
                (3.0332169491 * d * d) +
                (9.8393636378 * d * vr) +
                (8.6443678421 * vr * vr) -
                (0.1003268927 * d * d * d) -
                (0.4537289750 * d * d * vr) -
                (0.7614863242 * d * vr * vr) -
                (0.4505534229 * vr * vr * vr);
    }

    @Override
    public double getToleranceAnglePositiveMaxAngle(double d, double vr) {
        return (1.9041726738) -
                (11.2904142141 * d) -
                (10.6894618273 * vr) +
                (5.2917324901 * d * d) -
                (0.5505073071 * d * vr) -
                (4.8780282736 * vr * vr) +
                (0.1742113829 * d * d * d) +
                (3.9961905479 * d * d * vr) +
                (2.5957987309 * d * vr * vr) -
                (0.7551205158 * vr * vr * vr) -
                (0.5361157060 * d * d * d * d) -
                (1.7949438095 * d * d * d * vr) -
                (1.3945037127 * d * d * vr * vr) -
                (0.5319891572 * d * vr * vr * vr) -
                (0.2970664874 * vr * vr * vr * vr) -
                (0.0004509985 * d * d * d * d * d) -
                (0.1450744867 * d * d * d * d * vr) -
                (0.4971997738 * d * d * d * vr * vr) -
                (0.5700988770 * d * d * vr * vr * vr) -
                (0.3013588190 * d * vr * vr * vr * vr) -
                (0.0760990381 * vr * vr * vr * vr * vr);
    }

    // === NEG ANGLE TOLERANCE TARGETS ===

    @Override
    public double getToleranceAngleNegativeNormal(double d, double vr) {
        return (3.7295168544) -
                (0.8634412205 * d) +
                (0.0812682210 * vr) +
                (0.3064635488 * d * d) +
                (0.0792063988 * d * vr) +
                (0.0073728044 * vr * vr) -
                (0.0607668924 * d * d * d) -
                (0.0112729533 * d * d * vr) +
                (0.0179993595 * d * vr * vr) +
                (0.0008997120 * vr * vr * vr) +
                (0.0067693621 * d * d * d * d) +
                (0.0020994810 * d * d * d * vr) -
                (0.0007366645 * d * d * vr * vr) +
                (0.0032088125 * d * vr * vr * vr) +
                (0.0002955051 * vr * vr * vr * vr) -
                (0.0003126696 * d * d * d * d * d) -
                (0.0001455980 * d * d * d * d * vr) -
                (0.0000655074 * d * d * d * vr * vr) -
                (0.0002999068 * d * d * vr * vr * vr) +
                (0.0000885649 * d * vr * vr * vr * vr) +
                (0.0000243809 * vr * vr * vr * vr * vr);
    }

    @Override
    public double getToleranceAngleNegativeMinAngle(double d, double vr) {
        return (119.5042785173) -
                (30.7642021421 * d) -
                (53.1146395160 * vr) +
                (2.8676069604 * d * d) +
                (9.2861609937 * d * vr) +
                (8.1445627832 * vr * vr) -
                (0.0948197585 * d * d * d) -
                (0.4280505953 * d * d * vr) -
                (0.7171200459 * d * vr * vr) -
                (0.4235182639 * vr * vr * vr);
    }

    @Override
    public double getToleranceAngleNegativeMaxAngle(double d, double vr) {
        return (1.9272285700) -
                (11.3282234669 * d) -
                (10.6756035089 * vr) +
                (5.1821024120 * d * d) -
                (0.8007564545 * d * vr) -
                (4.9776786566 * vr * vr) +
                (0.2993196249 * d * d * d) +
                (4.2335441113 * d * d * vr) +
                (2.6943651587 * d * vr * vr) -
                (0.7533004880 * vr * vr * vr) -
                (0.5646054000 * d * d * d * d) -
                (1.8562573195 * d * d * d * vr) -
                (1.4533959627 * d * d * vr * vr) -
                (0.5771303773 * d * vr * vr * vr) -
                (0.3133420795 * vr * vr * vr * vr) +
                (0.0026849806 * d * d * d * d * d) -
                (0.1428190470 * d * d * d * d * vr) -
                (0.5125703812 * d * d * d * vr * vr) -
                (0.6029548645 * d * d * vr * vr * vr) -
                (0.3272289038 * d * vr * vr * vr * vr) -
                (0.0834091306 * vr * vr * vr * vr * vr);
    }

    // === ELLIPSE ANGLE TOLERANCE TARGETS ===

    @Override
    public double getToleranceEllipseAngleNormal(double d, double vr) {
        return (18.1358345255) -
                (10.7727787089 * d) -
                (4.8578999307 * vr) +
                (4.5543819051 * d * d) +
                (3.0912888436 * d * vr) +
                (0.7889334208 * vr * vr) -
                (1.0696367472 * d * d * d) -
                (1.0220286454 * d * d * vr) -
                (0.4683261168 * d * vr * vr) -
                (0.0745442928 * vr * vr * vr) +
                (0.1272435024 * d * d * d * d) +
                (0.1559979960 * d * d * d * vr) +
                (0.1003208305 * d * d * vr * vr) +
                (0.0298652725 * d * vr * vr * vr) +
                (0.0035167795 * vr * vr * vr * vr) -
                (0.0059932701 * d * d * d * d * d) -
                (0.0088977607 * d * d * d * d * vr) -
                (0.0072113535 * d * d * d * vr * vr) -
                (0.0029499526 * d * d * vr * vr * vr) -
                (0.0005927778 * d * vr * vr * vr * vr) -
                (0.0000616293 * vr * vr * vr * vr * vr);
    }

    @Override
    public double getToleranceEllipseAngleMinAngle(double d, double vr) {
        return  -
                (30.2007498257) +
                (10.0631206636 * d) +
                (10.0725379996 * vr) -
                (1.1315362577 * d * d) -
                (2.2265188220 * d * vr) -
                (0.7535581321 * vr * vr) +
                (0.0451155724 * d * d * d) +
                (0.1429970835 * d * d * vr) +
                (0.1202323367 * d * vr * vr) +
                (0.0324574910 * vr * vr * vr);
    }

    @Override
    public double getToleranceEllipseAngleMaxAngle(double d, double vr) {
        return (51.1225255430) +
                (190.6973270774 * d) +
                (200.2369365692 * vr) +
                (196.9119331837 * d * d) +
                (483.4846076965 * d * vr) +
                (280.5689635277 * vr * vr) +
                (39.6458528042 * d * d * d) +
                (216.8054218292 * d * d * vr) +
                (324.1654267311 * d * vr * vr) +
                (144.7620097399 * vr * vr * vr) +
                (1.4640174806 * d * d * d * d) +
                (15.9716684818 * d * d * d * vr) +
                (51.3617701530 * d * d * vr * vr) +
                (60.2850095034 * d * vr * vr * vr) +
                (23.2299064398 * vr * vr * vr * vr);
    }
}